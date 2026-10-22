/**
 * @file camera_processing.cpp
 * @brief Embedded Computer Vision & Laser Triangulation Pipeline for ESP32-CAM.
 */

#include "camera_processing.h"
#include "esp_timer.h"
#include <cmath>

CameraProcessor::CameraProcessor()
    : m_baselineCalibrated(false),
      m_mmPerPixel(DEFAULT_MM_PER_PIXEL),
      m_avgBrightness(0.0f),
      m_validPointsCount(0)
{
    for (int i = 0; i < CAM_WIDTH; i++) {
        m_baselineProfile[i] = CAM_HEIGHT / 2.0f; // Nominal center
        m_currentProfile[i] = CAM_HEIGHT / 2.0f;
        m_deviationProfile[i] = 0.0f;
    }
}

CameraProcessor::~CameraProcessor() {
    // Camera driver de-initialization if needed
}

bool CameraProcessor::initCamera() {
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_1;
    config.ledc_timer = LEDC_TIMER_1;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_siod = SIOD_GPIO_NUM;
    config.pin_sioc = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = CAM_PIXFORMAT;
    config.frame_size = FRAMESIZE_QVGA; // 320x240
    config.jpeg_quality = 12;
    config.fb_count = 2; // Double buffered for high frame-rate DMA
    config.grab_mode = CAMERA_GRAB_LATEST;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAM] Camera init failed with error 0x%x\n", err);
        return false;
    }

    sensor_t* s = esp_camera_sensor_get();
    if (s != nullptr) {
        // Configure exposure and gain for sharp contrast on laser line
        s->set_brightness(s, -1);      // Lower ambient brightness
        s->set_contrast(s, 2);         // Boost contrast to isolate laser stripe
        s->set_gainceiling(s, GAINCEILING_2X);
        s->set_whitebal(s, 0);         // Disable AWB
        s->set_exposure_ctrl(s, 0);    // Manual exposure
        s->set_aec_value(s, 150);      // Low exposure to suppress conveyor belt background
    }

    Serial.println("[CAM] OV2640 camera initialized successfully (QVGA Grayscale, 2 buffers)");
    return true;
}

/**
 * @brief Sub-pixel laser line extraction using center of gravity (Centroid) method.
 * y_c = sum(y * (I(y) - threshold)) / sum(I(y) - threshold)
 */
float CameraProcessor::extractLaserPeakColumn(const uint8_t* img, int col, int width, int height, float expectedY) {
    int startY = 0;
    int endY = height - 1;

    // Constrain search window around expected baseline to reject stray ambient reflections
    if (expectedY > 0) {
        startY = (int)fmax(0.0f, expectedY - LASER_SEARCH_WINDOW_RADIUS);
        endY = (int)fmin((float)(height - 1), expectedY + LASER_SEARCH_WINDOW_RADIUS);
    }

    float weightedSum = 0.0f;
    float totalWeight = 0.0f;
    int maxVal = 0;
    int maxIdx = -1;

    for (int y = startY; y <= endY; y++) {
        uint8_t val = img[y * width + col];
        if (val > maxVal) {
            maxVal = val;
            maxIdx = y;
        }
    }

    // Must exceed minimum brightness threshold to count as laser line
    if (maxVal < LASER_LINE_MIN_THRESHOLD || maxIdx < 0) {
        return -1.0f; // No laser detected in this column
    }

    // Compute subpixel centroid across the local peak neighborhood (+- 4 pixels)
    int localStart = fmax(startY, maxIdx - 4);
    int localEnd = fmin(endY, maxIdx + 4);

    for (int y = localStart; y <= localEnd; y++) {
        int val = (int)img[y * width + col];
        if (val >= LASER_LINE_MIN_THRESHOLD) {
            float weight = (float)(val - (LASER_LINE_MIN_THRESHOLD - 10));
            weightedSum += (float)y * weight;
            totalWeight += weight;
        }
    }

    if (totalWeight <= 0.001f) {
        return (float)maxIdx;
    }

    return weightedSum / totalWeight;
}

void CameraProcessor::applyMedianFilter(float* profile, int length, int kernelSize) {
    if (kernelSize <= 1) return;
    int half = kernelSize / 2;
    float temp[CAM_WIDTH];
    memcpy(temp, profile, length * sizeof(float));

    for (int i = half; i < length - half; i++) {
        // Simple 3-element median
        float a = temp[i - 1];
        float b = temp[i];
        float c = temp[i + 1];
        
        // Sorting 3 values
        if (a > b) { float t = a; a = b; b = t; }
        if (b > c) { float t = b; b = c; c = t; }
        if (a > b) { float t = a; a = b; b = t; }

        profile[i] = b;
    }
}

bool CameraProcessor::calibrateBaseline(int numFrames) {
    Serial.printf("[CAM] Starting baseline laser calibration (%d frames)...\n", numFrames);

    double sumProfiles[CAM_WIDTH] = {0.0};
    int validCounts[CAM_WIDTH] = {0};

    for (int f = 0; f < numFrames; f++) {
        camera_fb_t* fb = esp_camera_fb_get();
        if (!fb) {
            delay(10);
            continue;
        }

        for (int x = 0; x < CAM_WIDTH; x++) {
            float peak = extractLaserPeakColumn(fb->buf, x, fb->width, fb->height, -1.0f);
            if (peak > 0) {
                sumProfiles[x] += peak;
                validCounts[x]++;
            }
        }
        esp_camera_fb_return(fb);
        delay(20);
    }

    int calibratedCols = 0;
    for (int x = 0; x < CAM_WIDTH; x++) {
        if (validCounts[x] > (numFrames / 3)) {
            m_baselineProfile[x] = (float)(sumProfiles[x] / validCounts[x]);
            calibratedCols++;
        } else {
            // Fallback interpolation from neighbors
            m_baselineProfile[x] = (x > 0) ? m_baselineProfile[x - 1] : (CAM_HEIGHT / 2.0f);
        }
    }

    // Smooth baseline
    applyMedianFilter(m_baselineProfile, CAM_WIDTH, 5);

    if (calibratedCols < (CAM_WIDTH * 0.65)) {
        Serial.printf("[CAM] Warning: Laser stripe weak. Only %d/%d columns captured.\n", calibratedCols, CAM_WIDTH);
        m_baselineCalibrated = false;
        return false;
    }

    m_baselineCalibrated = true;
    Serial.printf("[CAM] Baseline calibration complete! %d/%d columns locked.\n", calibratedCols, CAM_WIDTH);
    return true;
}

bool CameraProcessor::processFrame(LaserDefectResult& result) {
    result.detected = false;
    result.severity = SEV_NONE;
    result.classification = DEFECT_TYPE_NONE;
    result.peakDeviationPx = 0.0f;
    result.peakDeviationMm = 0.0f;
    result.widthPx = 0;
    result.confidence = 0.0f;
    result.captureTimestampUs = (uint32_t)esp_timer_get_time();

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        return false;
    }

    m_validPointsCount = 0;
    float sumIntensity = 0.0f;

    // 1. Extract laser stripe
    for (int x = 0; x < CAM_WIDTH; x++) {
        float expectedY = m_baselineCalibrated ? m_baselineProfile[x] : -1.0f;
        float peak = extractLaserPeakColumn(fb->buf, x, fb->width, fb->height, expectedY);
        
        if (peak > 0) {
            m_currentProfile[x] = peak;
            m_validPointsCount++;
            sumIntensity += fb->buf[((int)peak) * fb->width + x];
        } else {
            // Missing segment or dropout
            m_currentProfile[x] = m_baselineCalibrated ? (m_baselineProfile[x] + 99.0f) : -1.0f;
        }
    }

    esp_camera_fb_return(fb);

    if (m_validPointsCount > 0) {
        m_avgBrightness = sumIntensity / m_validPointsCount;
    }

    if (!m_baselineCalibrated) {
        return true; // Frame acquired but no baseline yet
    }

    // 2. Measure deviations from calibrated baseline
    for (int x = 0; x < CAM_WIDTH; x++) {
        if (m_currentProfile[x] > 0 && m_currentProfile[x] < CAM_HEIGHT) {
            m_deviationProfile[x] = fabsf(m_currentProfile[x] - m_baselineProfile[x]);
        } else {
            // Severe dropout or missing laser line (e.g., deep puncture through belt)
            m_deviationProfile[x] = 45.0f; // High penalty
        }
    }

    // 3. Filter noise along profile
    applyMedianFilter(m_deviationProfile, CAM_WIDTH, NOISE_FILTER_KERNEL_SIZE);

    // 4. Defect blob segmentation (contiguous columns exceeding threshold)
    float noiseFloorPx = 2.0f; // ~0.45mm tolerance for belt vibration & roughness
    int currentRunLength = 0;
    int runStart = -1;
    float maxRunDeviation = 0.0f;

    int bestStart = -1;
    int bestEnd = -1;
    int bestWidth = 0;
    float bestMaxDevPx = 0.0f;

    for (int x = 0; x < CAM_WIDTH; x++) {
        float dev = m_deviationProfile[x];
        if (dev >= noiseFloorPx) {
            if (currentRunLength == 0) {
                runStart = x;
                maxRunDeviation = dev;
            } else {
                if (dev > maxRunDeviation) maxRunDeviation = dev;
            }
            currentRunLength++;
        } else {
            if (currentRunLength >= MIN_DEFECT_WIDTH_PX) {
                if (maxRunDeviation > bestMaxDevPx) {
                    bestMaxDevPx = maxRunDeviation;
                    bestWidth = currentRunLength;
                    bestStart = runStart;
                    bestEnd = x - 1;
                }
            }
            currentRunLength = 0;
            maxRunDeviation = 0.0f;
        }
    }

    // Final check for defect extending to edge of frame
    if (currentRunLength >= MIN_DEFECT_WIDTH_PX && maxRunDeviation > bestMaxDevPx) {
        bestMaxDevPx = maxRunDeviation;
        bestWidth = currentRunLength;
        bestStart = runStart;
        bestEnd = CAM_WIDTH - 1;
    }

    if (bestWidth >= MIN_DEFECT_WIDTH_PX && bestMaxDevPx > noiseFloorPx) {
        result.detected = true;
        result.startColumn = bestStart;
        result.endColumn = bestEnd;
        result.widthPx = bestWidth;
        result.peakDeviationPx = bestMaxDevPx;
        result.peakDeviationMm = bestMaxDevPx * m_mmPerPixel;
        result.estimatedWidthMm = (float)bestWidth * (m_mmPerPixel * 1.15f);
        result.estimatedLengthMm = result.peakDeviationMm * 1.8f; // Triangulated depth/chord ratio
        result.confidence = fmin(0.99f, 0.70f + (bestWidth * 0.015f) + (bestMaxDevPx * 0.01f));

        classifyDefect(bestWidth, result.peakDeviationMm, result);
    }

    return true;
}

void CameraProcessor::classifyDefect(int widthPx, float maxDevMm, LaserDefectResult& result) {
    // Severity grading according to industrial conveyor thresholds
    if (maxDevMm >= CRITICAL_DEVIATION_MM) {
        result.severity = SEV_CRITICAL;
    } else if (maxDevMm >= HIGH_DEVIATION_MM) {
        result.severity = SEV_HIGH;
    } else if (maxDevMm >= MEDIUM_DEVIATION_MM) {
        result.severity = SEV_MEDIUM;
    } else {
        result.severity = SEV_LOW;
    }

    // Geometric defect classification
    if (widthPx > (CAM_WIDTH * 0.4)) {
        // Wide transverse profile deformation -> Splice separation or transverse tear
        result.classification = DEFECT_TYPE_SPLICE_SPLIT;
    } else if (result.peakDeviationPx > 35.0f) {
        // Extremely deep drop or open void
        result.classification = DEFECT_TYPE_PUNCTURE;
    } else if (result.startColumn < 10 || result.endColumn > (CAM_WIDTH - 10)) {
        // Defect located at conveyor edge
        result.classification = DEFECT_TYPE_EDGE_FRAY;
    } else if (widthPx < 12 && maxDevMm > 3.0f) {
        // Narrow longitudinal slit
        result.classification = DEFECT_TYPE_LONGITUDINAL_TEAR;
    } else {
        result.classification = DEFECT_TYPE_SURFACE_GOUGE;
    }
}
