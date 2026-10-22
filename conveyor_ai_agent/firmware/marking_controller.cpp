/**
 * @file marking_controller.cpp
 * @brief Deterministic servo actuator marking controller with speed-compensated delay queue.
 */

#include "marking_controller.h"
#include "esp_timer.h"

MarkingController::MarkingController(uint8_t pwmPin, float camToMarkerDistMm)
    : m_pin(pwmPin),
      m_camToMarkerDistMm(camToMarkerDistMm),
      m_armed(true),
      m_state(SERVO_IDLE_SAFE),
      m_restPulseUs(SERVO_PULSE_REST_US),
      m_actuatePulseUs(SERVO_PULSE_ACTUATE_US),
      m_sprayDurationMs(DEFAULT_SPRAY_DURATION_MS),
      m_cooldownLockoutMs(SERVO_COOLDOWN_LOCKOUT_MS),
      m_stateEnterTimeUs(0),
      m_lastActuationEndUs(0),
      m_totalActuations(0),
      m_suppressedDuplicates(0)
{
    for (int i = 0; i < QUEUE_SIZE; i++) {
        m_queue[i].active = false;
    }
}

MarkingController::~MarkingController() {
    emergencyDisable();
}

void MarkingController::writePwmPulse(uint16_t pulseUs) {
    uint32_t duty = SERVO_US_TO_DUTY(pulseUs);
    ledcWrite(SERVO_LEDC_CHANNEL, duty);
}

void MarkingController::begin() {
    // Setup LEDC PWM peripheral for SG90 servo
    ledcSetup(SERVO_LEDC_CHANNEL, SERVO_LEDC_FREQ_HZ, SERVO_LEDC_RESOLUTION_BITS);
    ledcAttachPin(m_pin, SERVO_LEDC_CHANNEL);

    // Initial safe retracted position
    writePwmPulse(m_restPulseUs);
    m_state = SERVO_IDLE_SAFE;
    m_armed = true;

    Serial.printf("[SERVO] Marking controller initialized on GPIO %d (50Hz PWM, rest=%dus, actuate=%dus)\n",
                  m_pin, m_restPulseUs, m_actuatePulseUs);
}

void MarkingController::emergencyDisable() {
    m_armed = false;
    m_state = SERVO_IDLE_SAFE;
    writePwmPulse(m_restPulseUs); // Immediately release valve
    Serial.println("[SERVO] !!! EMERGENCY DISABLE ACTIVATED - Physical marking disarmed !!!");
}

void MarkingController::armSystem() {
    m_armed = true;
    m_state = SERVO_IDLE_SAFE;
    writePwmPulse(m_restPulseUs);
    Serial.println("[SERVO] Physical marking system ARMED.");
}

bool MarkingController::queueDefectMarking(uint32_t defectId, int64_t detectionTimeUs, float currentBeltSpeedMps) {
    if (!m_armed) {
        Serial.printf("[SERVO] Refusing to queue defect #%u: system disarmed.\n", defectId);
        return false;
    }

    if (currentBeltSpeedMps < 0.05f) {
        Serial.printf("[SERVO] Belt stopped or too slow (%.2f m/s). Marking queue rejected.\n", currentBeltSpeedMps);
        return false;
    }

    int64_t nowUs = esp_timer_get_time();

    // Check duplicate lockout window
    if ((nowUs - m_lastActuationEndUs) < ((int64_t)m_cooldownLockoutMs * 1000LL)) {
        m_suppressedDuplicates++;
        Serial.printf("[SERVO] Defect #%u suppressed by cooldown lockout (%d ms).\n", defectId, m_cooldownLockoutMs);
        return false;
    }

    // Calculate transit time from camera to spray nozzle:
    // Distance (m) = m_camToMarkerDistMm / 1000
    // Delay (sec) = Distance / Speed
    float transitDelaySec = (m_camToMarkerDistMm / 1000.0f) / currentBeltSpeedMps;
    int64_t transitDelayUs = (int64_t)(transitDelaySec * 1000000.0f);
    int64_t fireTimeUs = detectionTimeUs + transitDelayUs;

    // Find free queue slot
    for (int i = 0; i < QUEUE_SIZE; i++) {
        if (!m_queue[i].active) {
            m_queue[i].defectId = defectId;
            m_queue[i].detectionTimeUs = detectionTimeUs;
            m_queue[i].scheduledFireTimeUs = fireTimeUs;
            m_queue[i].beltSpeedMps = currentBeltSpeedMps;
            m_queue[i].distanceCamToMarkerMm = m_camToMarkerDistMm;
            m_queue[i].active = true;

            Serial.printf("[SERVO] Queued defect #%u for marking in %.2f s (at v=%.2f m/s)\n",
                          defectId, transitDelaySec, currentBeltSpeedMps);
            return true;
        }
    }

    Serial.println("[SERVO] Warning: Marking queue is FULL. Dropping event.");
    return false;
}

bool MarkingController::triggerManualTest(uint16_t pulseUs, uint32_t durationMs) {
    if (!m_armed) return false;
    if (m_state != SERVO_IDLE_SAFE) return false;

    Serial.printf("[SERVO] Manual dry-run test initiated: pulse=%d us, duration=%d ms\n", pulseUs, durationMs);
    m_state = SERVO_SPRAYING;
    m_stateEnterTimeUs = esp_timer_get_time();
    writePwmPulse(pulseUs);
    m_totalActuations++;
    return true;
}

void MarkingController::update() {
    int64_t nowUs = esp_timer_get_time();

    switch (m_state) {
        case SERVO_IDLE_SAFE: {
            if (!m_armed) break;

            // Check queue for defect arriving at the spray station
            for (int i = 0; i < QUEUE_SIZE; i++) {
                if (m_queue[i].active) {
                    if (nowUs >= m_queue[i].scheduledFireTimeUs) {
                        // Defect reached nozzle! Depress valve
                        Serial.printf("[SERVO] >>> ACTUATING SPRAY NOZZLE for defect #%u! <<<\n", m_queue[i].defectId);
                        m_queue[i].active = false;
                        m_state = SERVO_SPRAYING;
                        m_stateEnterTimeUs = nowUs;
                        writePwmPulse(m_actuatePulseUs);
                        m_totalActuations++;
                        break;
                    }
                }
            }
            break;
        }

        case SERVO_SPRAYING: {
            int64_t elapsedMs = (nowUs - m_stateEnterTimeUs) / 1000LL;
            if (elapsedMs >= (int64_t)m_sprayDurationMs) {
                // Spray duration complete; retract servo immediately
                writePwmPulse(m_restPulseUs);
                m_state = SERVO_COOLDOWN_LOCKOUT;
                m_stateEnterTimeUs = nowUs;
                m_lastActuationEndUs = nowUs;
                Serial.println("[SERVO] Actuation completed. Retracted to safe position.");
            }
            break;
        }

        case SERVO_COOLDOWN_LOCKOUT: {
            int64_t elapsedMs = (nowUs - m_stateEnterTimeUs) / 1000LL;
            if (elapsedMs >= (int64_t)m_cooldownLockoutMs) {
                m_state = SERVO_IDLE_SAFE;
            }
            break;
        }

        default:
            m_state = SERVO_IDLE_SAFE;
            writePwmPulse(m_restPulseUs);
            break;
    }
}
