/**
 * @file marking_controller.h
 * @brief Deterministic servo actuator marking controller with speed-compensated delay queue.
 */

#ifndef MARKING_CONTROLLER_H
#define MARKING_CONTROLLER_H

#include <Arduino.h>
#include "configuration.h"

enum ServoState {
    SERVO_IDLE_SAFE = 0,
    SERVO_TRANSIT_ARMED,
    SERVO_SPRAYING,
    SERVO_RETRACTING,
    SERVO_COOLDOWN_LOCKOUT
};

struct QueuedMarkingEvent {
    uint32_t defectId;
    int64_t detectionTimeUs;
    int64_t scheduledFireTimeUs;
    float beltSpeedMps;
    float distanceCamToMarkerMm;
    bool active;
};

class MarkingController {
public:
    MarkingController(uint8_t pwmPin = PIN_SERVO_PWM, float camToMarkerDistMm = DIST_CAM_TO_MARKER_MM);
    ~MarkingController();

    void begin();
    void update(); // Must be called frequently in main loop (non-blocking)

    // Schedule a defect marking action based on transit delay
    bool queueDefectMarking(uint32_t defectId, int64_t detectionTimeUs, float currentBeltSpeedMps);

    // Manual test trigger (dry-run without spraying if angle restricted)
    bool triggerManualTest(uint16_t pulseUs = SERVO_PULSE_ACTUATE_US, uint32_t durationMs = DEFAULT_SPRAY_DURATION_MS);

    // Safety controls
    void emergencyDisable();
    void armSystem();
    bool isArmed() const { return m_armed; }
    ServoState getState() const { return m_state; }

    // Actuation parameters
    void setActuatePulseUs(uint16_t pulseUs) { m_actuatePulseUs = pulseUs; }
    uint16_t getActuatePulseUs() const { return m_actuatePulseUs; }
    void setSprayDurationMs(uint32_t durationMs) { m_sprayDurationMs = durationMs; }
    uint32_t getSprayDurationMs() const { return m_sprayDurationMs; }
    void setNozzleDistanceMm(float distMm) { m_camToMarkerDistMm = distMm; }
    float getNozzleDistanceMm() const { return m_camToMarkerDistMm; }

    // Metrics
    uint32_t getTotalActuationsCount() const { return m_totalActuations; }
    uint32_t getSuppressedDuplicatesCount() const { return m_suppressedDuplicates; }

private:
    uint8_t m_pin;
    float m_camToMarkerDistMm;
    bool m_armed;
    ServoState m_state;

    uint16_t m_restPulseUs;
    uint16_t m_actuatePulseUs;
    uint32_t m_sprayDurationMs;
    uint32_t m_cooldownLockoutMs;

    int64_t m_stateEnterTimeUs;
    int64_t m_lastActuationEndUs;
    uint32_t m_totalActuations;
    uint32_t m_suppressedDuplicates;

    static const int QUEUE_SIZE = 8;
    QueuedMarkingEvent m_queue[QUEUE_SIZE];

    void writePwmPulse(uint16_t pulseUs);
};

#endif // MARKING_CONTROLLER_H
