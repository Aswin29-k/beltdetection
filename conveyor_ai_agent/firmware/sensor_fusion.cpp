/**
 * @file sensor_fusion.cpp
 * @brief Sensor fusion associating laser triangulation with belt joint reference.
 */

#include "sensor_fusion.h"
#include <cmath>

SensorFusionEngine::SensorFusionEngine(ProximitySensor& proxSensor)
    : m_proxSensor(proxSensor),
      m_trackedCount(0),
      m_nextPersistentId(1001)
{
}

SensorFusionEngine::~SensorFusionEngine() {
}

void SensorFusionEngine::begin() {
    m_trackedCount = 0;
    m_nextPersistentId = 1001;
    Serial.println("[FUSION] Sensor fusion engine initialized.");
}

int SensorFusionEngine::findMatchingTrackedDefect(float positionMm, float toleranceMm) {
    float beltLen = m_proxSensor.getBeltLengthMm();

    for (int i = 0; i < m_trackedCount; i++) {
        float diff = fabsf(m_trackedDefects[i].positionOnBeltMm - positionMm);
        // Handle wrap-around at joint boundary (0 / beltLen)
        if (diff > (beltLen / 2.0f)) {
            diff = beltLen - diff;
        }

        if (diff <= toleranceMm) {
            return i;
        }
    }
    return -1;
}

bool SensorFusionEngine::processObservation(const LaserDefectResult& laserResult, FusedInspectionRecord& fusedRecord) {
    if (!laserResult.detected) {
        return false;
    }

    int64_t captureTimeUs = (int64_t)laserResult.captureTimestampUs;
    uint32_t currentRev = m_proxSensor.getRevolutionCount();
    float beltSpeed = m_proxSensor.getInstantaneousBeltSpeedMps();
    float phaseDeg = m_proxSensor.getBeltPhaseAngleDeg(captureTimeUs);
    float beltPosMm = m_proxSensor.getDistanceFromJointMm(captureTimeUs);
    float beltLen = m_proxSensor.getBeltLengthMm();

    // Check if defect is joint-associated:
    // Distance from joint flag is either near start (< margin) or near end (> length - margin)
    bool isJoint = (beltPosMm <= JOINT_ZONE_MARGIN_MM) || (beltPosMm >= (beltLen - JOINT_ZONE_MARGIN_MM));

    // Match or create persistent tracked defect
    int matchIdx = findMatchingTrackedDefect(beltPosMm, 150.0f);
    uint32_t assignedId;
    float growthRate = 0.0f;
    bool alreadyMarked = false;

    if (matchIdx >= 0) {
        // Existing defect observed across multiple revolutions
        TrackedDefect& td = m_trackedDefects[matchIdx];
        assignedId = td.persistentId;
        td.lastSeenRev = currentRev;
        td.recurrenceCount++;
        td.latestDeviationMm = laserResult.peakDeviationMm;
        td.currentSeverity = laserResult.severity;
        td.classification = laserResult.classification;
        alreadyMarked = td.markingTriggered;

        uint32_t revSpan = td.lastSeenRev - td.firstSeenRev;
        if (revSpan > 0) {
            td.growthRateMmPerRev = (td.latestDeviationMm - td.initialDeviationMm) / (float)revSpan;
        }
        growthRate = td.growthRateMmPerRev;
    } else {
        // New defect record
        assignedId = m_nextPersistentId++;
        if (m_trackedCount < MAX_TRACKED_DEFECTS) {
            TrackedDefect& td = m_trackedDefects[m_trackedCount++];
            td.persistentId = assignedId;
            td.positionOnBeltMm = beltPosMm;
            td.phaseAngleDeg = phaseDeg;
            td.isJointAssociated = isJoint;
            td.initialDeviationMm = laserResult.peakDeviationMm;
            td.latestDeviationMm = laserResult.peakDeviationMm;
            td.growthRateMmPerRev = 0.0f;
            td.firstSeenRev = currentRev;
            td.lastSeenRev = currentRev;
            td.recurrenceCount = 1;
            td.currentSeverity = laserResult.severity;
            td.classification = laserResult.classification;
            td.markingTriggered = false;
        }
    }

    // Populate output record
    fusedRecord.defectId = assignedId;
    fusedRecord.timestampUs = captureTimeUs;
    fusedRecord.revolution = currentRev;
    fusedRecord.beltSpeedMps = beltSpeed;
    fusedRecord.phaseAngleDeg = phaseDeg;
    fusedRecord.positionOnBeltMm = beltPosMm;
    fusedRecord.isJointAssociated = isJoint;
    fusedRecord.laserDeviationPx = laserResult.peakDeviationPx;
    fusedRecord.laserDeviationMm = laserResult.peakDeviationMm;
    fusedRecord.estimatedWidthMm = laserResult.estimatedWidthMm;
    fusedRecord.estimatedLengthMm = laserResult.estimatedLengthMm;
    fusedRecord.severity = laserResult.severity;
    fusedRecord.classification = laserResult.classification;
    fusedRecord.confidence = laserResult.confidence;
    fusedRecord.growthRateMmPerRev = growthRate;

    // Critical marking rule:
    // Mark immediately if CRITICAL, or if HIGH and located in the high-stress vulcanized joint area.
    // Suppress duplicate marking if already marked recently.
    fusedRecord.requiresImmediateMarking = (!alreadyMarked) &&
        (laserResult.severity == SEV_CRITICAL || (laserResult.severity == SEV_HIGH && isJoint));

    if (fusedRecord.requiresImmediateMarking && matchIdx >= 0) {
        m_trackedDefects[matchIdx].markingTriggered = true;
    }

    return true;
}

const TrackedDefect* SensorFusionEngine::getTrackedDefect(int index) const {
    if (index >= 0 && index < m_trackedCount) {
        return &m_trackedDefects[index];
    }
    return nullptr;
}

int SensorFusionEngine::getJointDefectCount() const {
    int count = 0;
    for (int i = 0; i < m_trackedCount; i++) {
        if (m_trackedDefects[i].isJointAssociated) {
            count++;
        }
    }
    return count;
}
