import React, { useState } from 'react';
import { FileCode, Copy, Check, Terminal, FolderTree } from 'lucide-react';

interface FileEntry {
  path: string;
  category: 'firmware' | 'backend' | 'dashboard' | 'tests' | 'docs';
  description: string;
  content: string;
}

const FILES: FileEntry[] = [
  {
    path: 'firmware/configuration.h',
    category: 'firmware',
    description: 'Hardware pin mapping, optical triangulation math, and conflict safety rules for ESP32-CAM',
    content: `#ifndef CONFIGURATION_H
#define CONFIGURATION_H

#include <Arduino.h>

#define WIFI_SSID           "CONVEYOR_MONITOR_WIFI"
#define WIFI_PASSWORD       "IndustrialBeltGuard2026"
#define TELEMETRY_SERVER    "http://192.168.1.100:3000"

// GPIO Pin Mapping (AI Thinker ESP32-CAM)
#define PIN_PROXIMITY_SENSOR 12   // Optocoupled inductive proximity sensor (Active LOW)
#define PIN_SERVO_PWM        13   // SG90 Servo PWM signal (LEDC peripheral)
#define PIN_LASER_ENABLE     14   // Active HIGH to gate laser line generator
#define PIN_CALIBRATE_BUTTON 15   // Calibration trigger (Active LOW with internal pullup)
#define PIN_STATUS_LED       33   // Onboard small red LED (inverted)

#define CAM_WIDTH            320
#define CAM_HEIGHT           240
#define DEFAULT_MM_PER_PIXEL 0.225f
#define LASER_LINE_MIN_THRESHOLD 160
#define DIST_CAM_TO_MARKER_MM 1200.0f
#define DEFAULT_BELT_LENGTH_MM 12000.0f

#endif`
  },
  {
    path: 'firmware/camera_processing.h',
    category: 'firmware',
    description: 'Subpixel centroid laser line extraction and defect segmentation header',
    content: `#ifndef CAMERA_PROCESSING_H
#define CAMERA_PROCESSING_H

#include <Arduino.h>
#include "esp_camera.h"
#include "configuration.h"

enum DefectSeverity { SEV_NONE = 0, SEV_LOW, SEV_MEDIUM, SEV_HIGH, SEV_CRITICAL };
enum DefectClassification { DEFECT_TYPE_NONE = 0, DEFECT_TYPE_SURFACE_GOUGE, DEFECT_TYPE_PUNCTURE, DEFECT_TYPE_SPLICE_SPLIT, DEFECT_TYPE_LONGITUDINAL_TEAR, DEFECT_TYPE_EDGE_FRAY };

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
    bool initCamera();
    bool calibrateBaseline(int numFrames = 30);
    bool processFrame(LaserDefectResult& result);
    bool isCalibrated() const { return m_baselineCalibrated; }
    float getMmPerPixel() const { return m_mmPerPixel; }
    void setMmPerPixel(float mmPerPx) { m_mmPerPixel = mmPerPx; }
private:
    float m_baselineProfile[CAM_WIDTH];
    float m_currentProfile[CAM_WIDTH];
    float m_deviationProfile[CAM_WIDTH];
    bool m_baselineCalibrated;
    float m_mmPerPixel;
};

#endif`
  },
  {
    path: 'firmware/proximity_sensor.h',
    category: 'firmware',
    description: 'Inductive proximity sensor ISR, monotonic microsecond timing, and belt speed calculation',
    content: `#ifndef PROXIMITY_SENSOR_H
#define PROXIMITY_SENSOR_H

#include <Arduino.h>
#include "configuration.h"

class ProximitySensor {
public:
    ProximitySensor(uint8_t pin = PIN_PROXIMITY_SENSOR, float beltLengthMm = DEFAULT_BELT_LENGTH_MM);
    void begin();
    void IRAM_ATTR handlePulseInterrupt();
    uint32_t getRevolutionCount() const;
    int64_t getLastPulseTimestampUs() const;
    uint32_t getLastPeriodUs() const;
    float getInstantaneousBeltSpeedMps() const;
    float getInstantaneousBeltRpm() const;
    float getBeltPhaseAngleDeg(int64_t queryTimestampUs) const;
    float getDistanceFromJointMm(int64_t queryTimestampUs) const;
private:
    uint8_t m_pin;
    float m_beltLengthMm;
    volatile uint32_t m_revolutionCount;
    volatile int64_t m_lastPulseTimeUs;
    volatile uint32_t m_lastPeriodUs;
};

#endif`
  },
  {
    path: 'firmware/marking_controller.h',
    category: 'firmware',
    description: 'Deterministic SG90 servo defect marking controller with speed-compensated transit delay',
    content: `#ifndef MARKING_CONTROLLER_H
#define MARKING_CONTROLLER_H

#include <Arduino.h>
#include "configuration.h"

class MarkingController {
public:
    MarkingController(uint8_t pwmPin = PIN_SERVO_PWM, float camToMarkerDistMm = DIST_CAM_TO_MARKER_MM);
    void begin();
    void update(); // Non-blocking state machine in main loop
    bool queueDefectMarking(uint32_t defectId, int64_t detectionTimeUs, float currentBeltSpeedMps);
    bool triggerManualTest(uint16_t pulseUs = SERVO_PULSE_ACTUATE_US, uint32_t durationMs = DEFAULT_SPRAY_DURATION_MS);
    void emergencyDisable();
    void armSystem();
    bool isArmed() const { return m_armed; }
private:
    uint8_t m_pin;
    float m_camToMarkerDistMm;
    bool m_armed;
};

#endif`
  },
  {
    path: 'firmware/conveyor_monitor.ino',
    category: 'firmware',
    description: 'Main ESP32-CAM sketch with FreeRTOS dual-core tasks and watchdog timer',
    content: `// ESP32-CAM Dual-Core FreeRTOS Main Setup & Loop
#include <Arduino.h>
#include "configuration.h"
#include "camera_processing.h"
#include "proximity_sensor.h"
#include "sensor_fusion.h"
#include "marking_controller.h"

static CameraProcessor g_camera;
static ProximitySensor g_proximity(PIN_PROXIMITY_SENSOR, DEFAULT_BELT_LENGTH_MM);
static SensorFusionEngine g_fusion(g_proximity);
static MarkingController g_marker(PIN_SERVO_PWM, DIST_CAM_TO_MARKER_MM);

void cvProcessingTask(void* parameter) {
    LaserDefectResult laserResult;
    FusedInspectionRecord fusedRecord;
    while (true) {
        if (g_camera.processFrame(laserResult) && laserResult.detected) {
            if (g_fusion.processObservation(laserResult, fusedRecord)) {
                if (fusedRecord.requiresImmediateMarking) {
                    // Local deterministic marking: DO NOT WAIT FOR CLOUD
                    g_marker.queueDefectMarking(fusedRecord.defectId, fusedRecord.timestampUs, fusedRecord.beltSpeedMps);
                }
            }
        }
        vTaskDelay(pdMS_TO_TICKS(15));
    }
}

void setup() {
    Serial.begin(115200);
    g_proximity.begin();
    g_marker.begin();
    g_fusion.begin();
    g_camera.initCamera();
    g_camera.calibrateBaseline(35);
    xTaskCreatePinnedToCore(cvProcessingTask, "CV_Task", 8192, NULL, 2, NULL, 0);
}

void loop() {
    g_marker.update();
    delay(5);
}`
  },
  {
    path: 'backend/main.py',
    category: 'backend',
    description: 'FastAPI REST backend with SQLite persistence, telemetry ingestion, and Gemini endpoint',
    content: `from fastapi import FastAPI, HTTPException, Query
from schemas import TelemetryIn, DefectRecordIn, AIAnalysisRequest
from database import init_db, insert_telemetry, get_all_defects, insert_defect
from predictive_maintenance import compute_predictive_maintenance
from gemini_agent import ConveyorGeminiAgent

app = FastAPI(title="BeltGuard AI Backend")
init_db()
ai_agent = ConveyorGeminiAgent()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "BeltGuard AI Backend"}

@app.post("/api/defects", status_code=201)
def record_defect(defect: DefectRecordIn):
    # Deterministic local decision logging
    return {"success": True, "defectId": insert_defect(defect.dict())}

@app.post("/api/ai/analyze")
def analyze_with_gemini(request: AIAnalysisRequest):
    return ai_agent.analyze_conveyor_health(...)`
  },
  {
    path: 'dashboard/app.py',
    category: 'dashboard',
    description: 'Streamlit dashboard for real-time laser profile plots and predictive maintenance reports',
    content: `import streamlit as st
import requests
import numpy as np
import pandas as pd

st.set_page_config(page_title="BeltGuard AI Console", layout="wide")
st.title("🛡️ BeltGuard AI - Conveyor Monitoring System")
# Telemetry metrics, Laser profile comparison, Joint tracking, and Gemini diagnostics...`
  }
];

export const FirmwareExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FileEntry>(FILES[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-slate-100 text-sm">
            Embedded Firmware & Backend Source Code Repository
          </h3>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
        {/* File List */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Project Files
          </span>
          {FILES.map((file) => (
            <button
              key={file.path}
              onClick={() => setSelectedFile(file)}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono transition flex items-center gap-2 ${
                selectedFile.path === file.path
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 font-bold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{file.path}</span>
            </button>
          ))}
        </div>

        {/* Code Viewer */}
        <div className="md:col-span-3 bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
            <div>
              <span className="text-xs font-mono font-bold text-slate-200 block">
                {selectedFile.path}
              </span>
              <p className="text-[11px] text-slate-400">{selectedFile.description}</p>
            </div>
          </div>

          <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto max-h-72 p-2 bg-slate-900/60 rounded border border-slate-800/60 leading-relaxed">
            {selectedFile.content}
          </pre>
        </div>
      </div>
    </div>
  );
};
