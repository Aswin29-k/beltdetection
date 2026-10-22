/**
 * @file proximity_sensor.h
 * @brief Inductive proximity sensor driver with hardware interrupt & speed estimation.
 * 
 * DETECTION ARRANGEMENT:
 * - Inductive proximity sensors (e.g. LJ12A3-4-Z/BX NPN NO) require a ferrous or
 *   conductive metallic target.
 * - Rubber conveyor belts cannot be detected directly. A 0.5mm 316-stainless or
 *   mild-steel reference flag is embedded within the cold-vulcanized joint seam
 *   or clamped onto the belt edge splice guide.
 * - Sensor output is isolated via PC817 optocoupler to protect ESP32 GPIO 12.
 */

#ifndef PROXIMITY_SENSOR_H
#define PROXIMITY_SENSOR_H

#include <Arduino.h>
#include "configuration.h"

struct JointTimingEvent {
    uint32_t revolution;
    int64_t timestampUs;
    uint32_t periodUs;
    float beltSpeedMps;
    float beltRpm;
};

class ProximitySensor {
public:
    ProximitySensor(uint8_t pin = PIN_PROXIMITY_SENSOR, float beltLengthMm = DEFAULT_BELT_LENGTH_MM);
    ~ProximitySensor();

    void begin();
    
    // Interrupt Service Routine (called from static ISR stub)
    void IRAM_ATTR handlePulseInterrupt();

    // Query methods (non-blocking, thread-safe)
    uint32_t getRevolutionCount() const;
    int64_t getLastPulseTimestampUs() const;
    uint32_t getLastPeriodUs() const;
    float getInstantaneousBeltSpeedMps() const;
    float getInstantaneousBeltRpm() const;
    float getBeltPhaseAngleDeg(int64_t queryTimestampUs) const;
    float getDistanceFromJointMm(int64_t queryTimestampUs) const;

    // Configuration
    void setBeltLengthMm(float lengthMm) { m_beltLengthMm = lengthMm; }
    float getBeltLengthMm() const { return m_beltLengthMm; }

private:
    uint8_t m_pin;
    float m_beltLengthMm;

    volatile uint32_t m_revolutionCount;
    volatile int64_t m_lastPulseTimeUs;
    volatile int64_t m_prevPulseTimeUs;
    volatile uint32_t m_lastPeriodUs;
    volatile bool m_newPulseFlag;

    // Moving average filter for stable speed estimation
    static const int SPEED_FILTER_SIZE = 4;
    float m_speedHistory[SPEED_FILTER_SIZE];
    int m_speedHistoryIdx;
};

#endif // PROXIMITY_SENSOR_H
