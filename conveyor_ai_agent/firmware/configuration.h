/**
 * @file configuration.h
 * @brief Hardware pin mapping, calibration parameters, and network configuration
 *        for ESP32-CAM Conveyor Belt Monitoring System (AI-Thinker module).
 * 
 * CRITICAL HARDWARE & GPIO CONFLICT ANALYSIS:
 * - ESP32-CAM AI-Thinker uses almost all pins for the OV2640 camera interface:
 *     Y2-Y9: GPIO 5, 18, 19, 21, 36, 39, 34, 35
 *     XCLK:  GPIO 0 (Do not pull low during boot, strapping pin!)
 *     PCLK:  GPIO 22
 *     VSYNC: GPIO 25
 *     HREF:  GPIO 23
 *     SIOD:  GPIO 26 (I2C SDA)
 *     SIOC:  GPIO 27 (I2C SCL)
 *     Flash LED: GPIO 4 (High current onboard LED)
 * - SAFE AVAILABLE GPIOs FOR EXTERNAL PERIPHERALS:
 *     GPIO 12 (HS2_DATA2) - Proximity Sensor Input (Safe if not pulled high at boot)
 *     GPIO 13 (HS2_DATA3) - SG90 Servo PWM Output
 *     GPIO 14 (HS2_CLK)   - Line Laser Diode Control (MOSFET switch)
 *     GPIO 15 (HS2_CMD)   - Emergency / Calibration Mode Pushbutton
 *     GPIO 33 (Internal Red LED, active low) - System Heartbeat Indicator
 * 
 * ELECTRICAL ISOLATION NOTICE:
 * - Inductive proximity sensors typically run at 10-30V DC. NEVER connect
 *   12V/24V NPN or PNP output directly to ESP32 GPIO. Use PC817 optocoupler
 *   with 1k pull-up resistor to 3.3V rail.
 * - SG90 servo draws peak surge currents up to 600mA during motor stall.
 *   NEVER power the servo from the ESP32 3.3V or 5V VCC pin. Use an external
 *   5V 2A switching regulator with a common ground (GND) reference.
 */

#ifndef CONFIGURATION_H
#define CONFIGURATION_H

#include <Arduino.h>

// ==========================================
// Network & Telemetry Server Credentials
// ==========================================
#define WIFI_SSID           "CONVEYOR_MONITOR_WIFI"
#define WIFI_PASSWORD       "IndustrialBeltGuard2026"
#define TELEMETRY_SERVER    "http://192.168.1.100:3000"
#define TELEMETRY_INTERVAL_MS 1000

// ==========================================
// GPIO Pin Mapping
// ==========================================
#define PIN_PROXIMITY_SENSOR 12   // Optocoupled inductive proximity sensor (Active LOW)
#define PIN_SERVO_PWM        13   // SG90 Servo PWM signal (LEDC peripheral)
#define PIN_LASER_ENABLE     14   // Active HIGH to gate laser line generator
#define PIN_CALIBRATE_BUTTON 15   // Calibration trigger (Active LOW with internal pullup)
#define PIN_STATUS_LED       33   // Onboard small red LED (inverted)

// ==========================================
// Camera Settings & Image Resolution
// ==========================================
// Frame size: FRAMESIZE_QVGA (320x240) provides optimal balance between
// line extraction throughput (25-30 FPS) and SRAM footprint on ESP32.
#define CAM_WIDTH            320
#define CAM_HEIGHT           240
#define CAM_PIXFORMAT        PIXFORMAT_GRAYSCALE

// Camera Pin Definition (AI Thinker ESP32-CAM)
#define PWDN_GPIO_NUM        32
#define RESET_GPIO_NUM       -1
#define XCLK_GPIO_NUM        0
#define SIOD_GPIO_NUM        26
#define SIOC_GPIO_NUM        27
#define Y9_GPIO_NUM          35
#define Y8_GPIO_NUM          34
#define Y7_GPIO_NUM          39
#define Y6_GPIO_NUM          36
#define Y5_GPIO_NUM          21
#define Y4_GPIO_NUM          19
#define Y3_GPIO_NUM          18
#define Y2_GPIO_NUM          5
#define VSYNC_GPIO_NUM       25
#define HREF_GPIO_NUM        23
#define PCLK_GPIO_NUM        22

// ==========================================
// Triangulation & Optics Calibration
// ==========================================
// Triangulation geometry:
// Angle of incidence of laser sheet: theta_deg = 45 deg
// Distance baseline B between camera optical axis & laser: 80 mm
// Nominal working distance H_0: 250 mm
// Optical scale factor: mm per pixel along camera Y-axis
#define DEFAULT_MM_PER_PIXEL        0.225f
#define LASER_LINE_MIN_THRESHOLD    160     // Pixel brightness threshold (0-255)
#define LASER_SEARCH_WINDOW_RADIUS  25      // Search radius around baseline (pixels)
#define NOISE_FILTER_KERNEL_SIZE    3       // Median filter window for line profile
#define MIN_DEFECT_WIDTH_PX         4       // Minimum contiguous defective columns
#define CRITICAL_DEVIATION_MM       6.0f    // DIN 22102 critical defect threshold
#define HIGH_DEVIATION_MM           4.0f
#define MEDIUM_DEVIATION_MM         2.0f

// ==========================================
// Proximity Sensor & Joint Detection
// ==========================================
#define PROXIMITY_DEBOUNCE_US       50000UL // 50 ms debounce for mechanical/inductive contact
#define JOINT_ZONE_MARGIN_MM        300.0f  // Window around joint considered "joint-associated"
#define DEFAULT_BELT_LENGTH_MM      12000.0f // Total length of closed conveyor loop (12 m)

// ==========================================
// SG90 Servo Actuator & Marking Station
// ==========================================
#define SERVO_LEDC_CHANNEL          0
#define SERVO_LEDC_FREQ_HZ          50
#define SERVO_LEDC_RESOLUTION_BITS  16      // 16-bit PWM (0 - 65535)

// 50Hz period = 20,000 us.
// SG90 Pulse: 1000us (0 deg) to 2000us (180 deg)
#define SERVO_US_TO_DUTY(us)        ((uint32_t)(((us) * 65535UL) / 20000UL))
#define SERVO_PULSE_REST_US         1000    // 0 degrees (Safe retracted nozzle)
#define SERVO_PULSE_ACTUATE_US      1750    // ~68 degrees (Presses aerosol spray valve)

#define DEFAULT_SPRAY_DURATION_MS   350     // Duration nozzle valve is depressed
#define SERVO_COOLDOWN_LOCKOUT_MS   1500    // Prevent excessive continuous spraying
#define DIST_CAM_TO_MARKER_MM       1200.0f // Physical distance along belt from camera to spray nozzle

// ==========================================
// System Watchdog & Safety
// ==========================================
#define WATCHDOG_TIMEOUT_SEC        5       // Hardware task watchdog timeout

#endif // CONFIGURATION_H
