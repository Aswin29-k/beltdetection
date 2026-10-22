/**
 * @file proximity_sensor.cpp
 * @brief Inductive proximity sensor driver with hardware interrupt & speed estimation.
 */

#include "proximity_sensor.h"
#include "esp_timer.h"

// Static pointer for ISR routing
static ProximitySensor* s_instance = nullptr;

static void IRAM_ATTR isrProximityThunk() {
    if (s_instance != nullptr) {
        s_instance->handlePulseInterrupt();
    }
}

ProximitySensor::ProximitySensor(uint8_t pin, float beltLengthMm)
    : m_pin(pin),
      m_beltLengthMm(beltLengthMm),
      m_revolutionCount(0),
      m_lastPulseTimeUs(0),
      m_prevPulseTimeUs(0),
      m_lastPeriodUs(4700000UL), // Default ~4.7s nominal revolution
      m_newPulseFlag(false),
      m_speedHistoryIdx(0)
{
    s_instance = this;
    for (int i = 0; i < SPEED_FILTER_SIZE; i++) {
        m_speedHistory[i] = 0.85f; // Initial nominal 0.85 m/s
    }
}

ProximitySensor::~ProximitySensor() {
    detachInterrupt(digitalPinToInterrupt(m_pin));
    if (s_instance == this) {
        s_instance = nullptr;
    }
}

void ProximitySensor::begin() {
    pinMode(m_pin, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(m_pin), isrProximityThunk, FALLING);
    Serial.printf("[PROX] Inductive sensor initialized on GPIO %d (FALLING edge trigger)\n", m_pin);
}

void IRAM_ATTR ProximitySensor::handlePulseInterrupt() {
    int64_t nowUs = esp_timer_get_time();
    int64_t elapsedUs = nowUs - m_lastPulseTimeUs;

    // Software debounce filter
    if (elapsedUs < (int64_t)PROXIMITY_DEBOUNCE_US) {
        return; // Ignore spurious bounce or electrical noise
    }

    // Must be greater than 200ms to be a valid conveyor revolution (max ~300 RPM)
    if (elapsedUs > 200000LL && m_lastPulseTimeUs > 0) {
        m_lastPeriodUs = (uint32_t)elapsedUs;
        m_revolutionCount++;
        m_prevPulseTimeUs = m_lastPulseTimeUs;
        m_newPulseFlag = true;
    }

    m_lastPulseTimeUs = nowUs;
}

uint32_t ProximitySensor::getRevolutionCount() const {
    return m_revolutionCount;
}

int64_t ProximitySensor::getLastPulseTimestampUs() const {
    return m_lastPulseTimeUs;
}

uint32_t ProximitySensor::getLastPeriodUs() const {
    return m_lastPeriodUs;
}

float ProximitySensor::getInstantaneousBeltSpeedMps() const {
    if (m_lastPeriodUs == 0) return 0.0f;
    float periodSec = (float)m_lastPeriodUs / 1000000.0f;
    float beltLengthM = m_beltLengthMm / 1000.0f;
    return beltLengthM / periodSec;
}

float ProximitySensor::getInstantaneousBeltRpm() const {
    if (m_lastPeriodUs == 0) return 0.0f;
    float periodSec = (float)m_lastPeriodUs / 1000000.0f;
    return 60.0f / periodSec;
}

float ProximitySensor::getBeltPhaseAngleDeg(int64_t queryTimestampUs) const {
    if (m_lastPeriodUs == 0 || m_lastPulseTimeUs == 0) return 0.0f;
    int64_t dt = queryTimestampUs - m_lastPulseTimeUs;
    if (dt < 0) dt = 0;
    float phaseFraction = (float)(dt % (int64_t)m_lastPeriodUs) / (float)m_lastPeriodUs;
    return phaseFraction * 360.0f;
}

float ProximitySensor::getDistanceFromJointMm(int64_t queryTimestampUs) const {
    if (m_lastPeriodUs == 0 || m_lastPulseTimeUs == 0) return 0.0f;
    int64_t dt = queryTimestampUs - m_lastPulseTimeUs;
    if (dt < 0) dt = 0;
    float fraction = (float)(dt % (int64_t)m_lastPeriodUs) / (float)m_lastPeriodUs;
    return fraction * m_beltLengthMm;
}
