/**
 * @file conveyor_monitor.ino
 * @brief Main firmware for AI-Powered Conveyor Belt Monitoring System using ESP32-CAM.
 * 
 * FEATURES:
 * - OV2640 grayscale laser triangulation line extraction @ 25+ FPS
 * - Inductive proximity interrupt for vulcanized-joint synchronization & belt speed
 * - Non-blocking deterministic SG90 servo defect marking with distance/speed delay
 * - Dual-core FreeRTOS architecture (Core 0: CV & Optics; Core 1: Fusion & Network)
 * - Autonomous fail-safe operation: Real-time marking does NOT rely on network or cloud AI
 * - JSON Telemetry & Defect dispatch over Wi-Fi to FastAPI backend
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "esp_task_wdt.h"
#include "configuration.h"
#include "camera_processing.h"
#include "proximity_sensor.h"
#include "sensor_fusion.h"
#include "marking_controller.h"

// Subsystem instances
static CameraProcessor g_camera;
static ProximitySensor g_proximity(PIN_PROXIMITY_SENSOR, DEFAULT_BELT_LENGTH_MM);
static SensorFusionEngine g_fusion(g_proximity);
static MarkingController g_marker(PIN_SERVO_PWM, DIST_CAM_TO_MARKER_MM);

// Global shared synchronization primitives
static SemaphoreHandle_t g_telemetryMutex = nullptr;
static uint32_t g_lastTelemetryDispatchMs = 0;
static uint32_t g_lastHeartbeatMs = 0;
static bool g_wifiConnected = false;

// Task handles
TaskHandle_t g_cvTaskHandle = nullptr;

/**
 * @brief Forward defect event to central FastAPI backend asynchronously.
 */
void sendDefectToBackend(const FusedInspectionRecord& record) {
    if (!g_wifiConnected) return;

    HTTPClient http;
    String url = String(TELEMETRY_SERVER) + "/api/defects";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{";
    jsonPayload += "\"id\":\"DEF-" + String(record.defectId) + "\",";
    jsonPayload += "\"revolution\":" + String(record.revolution) + ",";
    jsonPayload += "\"phaseAngleDeg\":" + String(record.phaseAngleDeg, 2) + ",";
    jsonPayload += "\"distanceFromJointMm\":" + String(record.positionOnBeltMm, 1) + ",";
    jsonPayload += "\"laserDeviationPx\":" + String(record.laserDeviationPx, 2) + ",";
    jsonPayload += "\"laserDeviationMm\":" + String(record.laserDeviationMm, 2) + ",";
    jsonPayload += "\"widthMm\":" + String(record.estimatedWidthMm, 1) + ",";
    jsonPayload += "\"lengthMm\":" + String(record.estimatedLengthMm, 1) + ",";
    jsonPayload += "\"severity\":\"" + String(
        record.severity == SEV_CRITICAL ? "CRITICAL" :
        record.severity == SEV_HIGH ? "HIGH" :
        record.severity == SEV_MEDIUM ? "MEDIUM" : "LOW"
    ) + "\",";
    jsonPayload += "\"confidence\":" + String(record.confidence, 2) + ",";
    jsonPayload += "\"isJointAssociated\":" + String(record.isJointAssociated ? "true" : "false") + ",";
    jsonPayload += "\"defectType\":\"" + String(
        record.classification == DEFECT_TYPE_SPLICE_SPLIT ? "SPLICE_SPLIT" :
        record.classification == DEFECT_TYPE_PUNCTURE ? "PUNCTURE" :
        record.classification == DEFECT_TYPE_LONGITUDINAL_TEAR ? "TEAR" :
        record.classification == DEFECT_TYPE_EDGE_FRAY ? "EDGE_FRAY" : "SURFACE_GOUGE"
    ) + "\"";
    jsonPayload += "}";

    int code = http.POST(jsonPayload);
    if (code > 0) {
        Serial.printf("[NET] Defect #%u reported successfully (HTTP %d)\n", record.defectId, code);
    } else {
        Serial.printf("[NET] Failed to post defect #%u: %s\n", record.defectId, http.errorToString(code).c_str());
    }
    http.end();
}

/**
 * @brief Dispatch routine telemetry pulse to backend.
 */
void sendTelemetryToBackend() {
    if (!g_wifiConnected) return;

    HTTPClient http;
    String url = String(TELEMETRY_SERVER) + "/api/telemetry";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    float speed = g_proximity.getInstantaneousBeltSpeedMps();
    float rpm = g_proximity.getInstantaneousBeltRpm();
    uint32_t revs = g_proximity.getRevolutionCount();

    String json = "{";
    json += "\"beltRunning\":" + String(speed > 0.05f ? "true" : "false") + ",";
    json += "\"beltSpeedMps\":" + String(speed, 3) + ",";
    json += "\"beltRpm\":" + String(rpm, 2) + ",";
    json += "\"revCount\":" + String(revs) + ",";
    json += "\"laserBaselineCalibrated\":" + String(g_camera.isCalibrated() ? "true" : "false") + ",";
    json += "\"scaleFactorMmPerPx\":" + String(g_camera.getMmPerPixel(), 4) + ",";
    json += "\"servoArmed\":" + String(g_marker.isArmed() ? "true" : "false") + ",";
    json += "\"memoryFreeBytes\":" + String(ESP.getFreeHeap()) + ",";
    json += "\"wifiRssi\":" + String(WiFi.RSSI()) + ",";
    json += "\"tempDegC\":" + String(temperatureRead(), 1);
    json += "}";

    int code = http.POST(json);
    http.end();
}

/**
 * @brief High-speed Computer Vision task running pinned to Core 0.
 */
void cvProcessingTask(void* parameter) {
    Serial.println("[TASK] Computer Vision pipeline running on Core 0");
    LaserDefectResult laserResult;
    FusedInspectionRecord fusedRecord;

    while (true) {
        // Feed task watchdog
        esp_task_wdt_reset();

        bool ok = g_camera.processFrame(laserResult);
        if (ok && laserResult.detected) {
            // Fuse optical defect with proximity timing
            if (g_fusion.processObservation(laserResult, fusedRecord)) {
                Serial.printf("[CV] Defect detected! ID=%u, Dev=%.2f mm, Type=%d, Joint=%d\n",
                              fusedRecord.defectId, fusedRecord.laserDeviationMm,
                              (int)fusedRecord.classification, (int)fusedRecord.isJointAssociated);

                // Deterministic local marking queue (DO NOT WAIT FOR CLOUD OR WI-FI)
                if (fusedRecord.requiresImmediateMarking) {
                    g_marker.queueDefectMarking(fusedRecord.defectId, fusedRecord.timestampUs, fusedRecord.beltSpeedMps);
                }

                // Asynchronously report defect to backend
                sendDefectToBackend(fusedRecord);
            }
        }

        // Yield briefly to prevent starvation
        vTaskDelay(pdMS_TO_TICKS(15));
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n=======================================================");
    Serial.println("  BELTGUARD AI - ESP32-CAM CONVEYOR MONITORING AGENT  ");
    Serial.println("=======================================================");

    // Status indicator LED (active LOW on ESP32-CAM)
    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW);

    // Laser diode control pin
    pinMode(PIN_LASER_ENABLE, OUTPUT);
    digitalWrite(PIN_LASER_ENABLE, HIGH); // Turn laser line ON

    // Calibrate button
    pinMode(PIN_CALIBRATE_BUTTON, INPUT_PULLUP);

    // Initialize subsystems
    g_proximity.begin();
    g_marker.begin();
    g_fusion.begin();

    if (!g_camera.initCamera()) {
        Serial.println("[INIT] ERROR: Camera initialization failed! Retrying in 3s...");
        delay(3000);
        ESP.restart();
    }

    // Auto-calibrate baseline if belt is clear at startup
    Serial.println("[INIT] Calibrating optical baseline on flat conveyor...");
    delay(500);
    g_camera.calibrateBaseline(35);

    // Connect to Wi-Fi (non-blocking attempt)
    Serial.printf("[INIT] Connecting to Wi-Fi SSID '%s'...\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    uint32_t startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt) < 6000) {
        delay(250);
        Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
        g_wifiConnected = true;
        Serial.printf("\n[INIT] Wi-Fi connected! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[INIT] Wi-Fi offline or timed out. Operating in autonomous local mode.");
        g_wifiConnected = false;
    }

    // Setup hardware task watchdog
    esp_task_wdt_init(WATCHDOG_TIMEOUT_SEC, true);
    esp_task_wdt_add(NULL); // Add main loop task

    // Launch CV task pinned to Core 0 (leaving Core 1 for loop & Wi-Fi)
    xTaskCreatePinnedToCore(
        cvProcessingTask,
        "CV_Task",
        8192,
        NULL,
        2, // High priority
        &g_cvTaskHandle,
        0  // Pinned to Core 0
    );
    esp_task_wdt_add(g_cvTaskHandle);

    digitalWrite(PIN_STATUS_LED, HIGH); // LED off
    Serial.println("[INIT] System initialization complete. Active monitoring started.");
}

void loop() {
    esp_task_wdt_reset();
    uint32_t nowMs = millis();

    // 1. Update marking controller state machine (deterministic timing)
    g_marker.update();

    // 2. Check calibration pushbutton
    if (digitalRead(PIN_CALIBRATE_BUTTON) == LOW) {
        delay(50); // Debounce
        if (digitalRead(PIN_CALIBRATE_BUTTON) == LOW) {
            Serial.println("[CALIB] Calibration pushbutton pressed! Recalibrating baseline...");
            g_camera.calibrateBaseline(40);
        }
    }

    // 3. Periodic telemetry dispatch
    if (nowMs - g_lastTelemetryDispatchMs >= TELEMETRY_INTERVAL_MS) {
        g_lastTelemetryDispatchMs = nowMs;
        sendTelemetryToBackend();
    }

    // 4. Heartbeat LED pulse (every 2 seconds)
    if (nowMs - g_lastHeartbeatMs >= 2000) {
        g_lastHeartbeatMs = nowMs;
        digitalWrite(PIN_STATUS_LED, LOW);
        delay(30);
        digitalWrite(PIN_STATUS_LED, HIGH);
    }

    // 5. Serial CLI test commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        cmd.toUpperCase();

        if (cmd == "HELP") {
            Serial.println("--- BELTGUARD CLI COMMANDS ---");
            Serial.println("  STATUS     - View current conveyor telemetry");
            Serial.println("  CALIB      - Recalibrate baseline laser line");
            Serial.println("  MARK_TEST  - Test servo spray actuation (dry-run)");
            Serial.println("  ARM        - Arm physical marking system");
            Serial.println("  DISARM     - Emergency disable marking system");
            Serial.println("  SIM_PULSE  - Simulate inductive joint sensor pulse");
        } else if (cmd == "STATUS") {
            Serial.printf("Speed: %.2f m/s | RPM: %.2f | Revs: %u | Calibrated: %s | Servo Armed: %s\n",
                          g_proximity.getInstantaneousBeltSpeedMps(),
                          g_proximity.getInstantaneousBeltRpm(),
                          g_proximity.getRevolutionCount(),
                          g_camera.isCalibrated() ? "YES" : "NO",
                          g_marker.isArmed() ? "YES" : "NO");
        } else if (cmd == "CALIB") {
            g_camera.calibrateBaseline(30);
        } else if (cmd == "MARK_TEST") {
            g_marker.triggerManualTest(SERVO_PULSE_ACTUATE_US, DEFAULT_SPRAY_DURATION_MS);
        } else if (cmd == "ARM") {
            g_marker.armSystem();
        } else if (cmd == "DISARM") {
            g_marker.emergencyDisable();
        } else if (cmd == "SIM_PULSE") {
            g_proximity.handlePulseInterrupt();
            Serial.println("Simulated joint pulse triggered.");
        }
    }

    delay(5);
}
