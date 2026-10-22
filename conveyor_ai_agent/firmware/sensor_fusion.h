/**
 * @file sensor_fusion.h
 * @brief Sensor fusion associating laser triangulation with belt joint reference.
 */

#ifndef SENSOR_FUSION_H
#define SENSOR_FUSION_H

#include <Arduino.h>
#include "camera_processing.h"
#include "proximity_sensor.h"

struct TrackedDefect {
    uint32_t persistentId;
    float positionOnBeltMm;       // 0 to BeltLength
    float phaseAngleDeg;          // 0 to 360 deg
    bool isJointAssociated;
    float initialDeviationMm;
    float latestDeviationMm;
    float growthRateMmPerRev;
    uint32_t firstSeenRev;
    uint32_t lastSeenRev;
    uint32_t recurrenceCount;
    DefectSeverity currentSeverity;
    DefectClassification classification;
    bool markingTriggered;
};

struct FusedInspectionRecord {
    uint32_t defectId;
    int64_t timestampUs;
    uint32_t revolution;
    float beltSpeedMps;
    float phaseAngleDeg;
    float positionOnBeltMm;
    bool isJointAssociated;
    float laserDeviationPx;
    float laserDeviationMm;
    float estimatedWidthMm;
    float estimatedLengthMm;
    DefectSeverity severity;
    DefectClassification classification;
    float confidence;
    bool requiresImmediateMarking;
    float growthRateMmPerRev;
};

class SensorFusionEngine {
public:
    SensorFusionEngine(ProximitySensor& proxSensor);
    ~SensorFusionEngine();

    void begin();
    bool processObservation(const LaserDefectResult& laserResult, FusedInspectionRecord& fusedRecord);

    // Historical tracking queries
    int getTrackedDefectCount() const { return m_trackedCount; }
    const TrackedDefect* getTrackedDefect(int index) const;
    int getJointDefectCount() const;

private:
    ProximitySensor& m_proxSensor;
    static const int MAX_TRACKED_DEFECTS = 32;
    TrackedDefect m_trackedDefects[MAX_TRACKED_DEFECTS];
    int m_trackedCount;
    uint32_t m_nextPersistentId;

    int findMatchingTrackedDefect(float positionMm, float toleranceMm = 120.0f);
};

#endif // SENSOR_FUSION_H
