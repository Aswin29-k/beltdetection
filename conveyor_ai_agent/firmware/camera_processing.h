/**
 * @file camera_processing.h
 * @brief Embedded Computer Vision & Laser Triangulation Pipeline for ESP32-CAM.
 */

#ifndef CAMERA_PROCESSING_H
#define CAMERA_PROCESSING_H

#include <Arduino.h>
#include "esp_camera.h"
#include "configuration.h"

enum DefectSeverity {
    SEV_NONE = 0,
    SEV_LOW,
    SEV_MEDIUM,
    SEV_HIGH,
    SEV_CRITICAL
};

enum DefectClassification {
    DEFECT_TYPE_NONE = 0,
    DEFECT_TYPE_SURFACE_GOUGE,
    DEFECT_TYPE_PUNCTURE,
    DEFECT_TYPE_SPLICE_SPLIT,
    DEFECT_TYPE_LONGITUDINAL_TEAR,
    DEFECT_TYPE_EDGE_FRAY
};

struct LaserDefectResult {
    bool detected;
    int startColumn;
    int endColumn;
    int widthPx;
    float peakDeviationPx;
    float peakDeviationMm;
    float estimatedWidthMm;
    float estimatedLengthMm;
    DefectSeverity severity;
    DefectClassification classification;
    float confidence;
    uint32_t captureTimestampUs;
};

class CameraProcessor {
public:
    CameraProcessor();
    ~CameraProcessor();

    bool initCamera();
    bool calibrateBaseline(int numFrames = 30);
    bool processFrame(LaserDefectResult& result);
    
    // Calibration getters/setters
    bool isCalibrated() const { return m_baselineCalibrated; }
    float getMmPerPixel() const { return m_mmPerPixel; }
    void setMmPerPixel(float mmPerPx) { m_mmPerPixel = mmPerPx; }
    const float* getBaselineProfile() const { return m_baselineProfile; }
    const float* getCurrentProfile() const { return m_currentProfile; }

    // Diagnostic metrics
    float getAverageLaserBrightness() const { return m_avgBrightness; }
    int getValidLaserPoints() const { return m_validPointsCount; }

private:
    float m_baselineProfile[CAM_WIDTH];
    float m_currentProfile[CAM_WIDTH];
    float m_deviationProfile[CAM_WIDTH];
    bool m_baselineCalibrated;
    float m_mmPerPixel;
    float m_avgBrightness;
    int m_validPointsCount;

    // Sub-pixel centroid laser extraction along a vertical column
    float extractLaserPeakColumn(const uint8_t* img, int col, int width, int height, float expectedY);
    void applyMedianFilter(float* profile, int length, int kernelSize);
    void classifyDefect(int widthPx, float maxDevMm, LaserDefectResult& result);
};

#endif // CAMERA_PROCESSING_H
