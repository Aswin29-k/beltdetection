import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Layers,
  Compass,
  Cpu,
  Target,
  Sparkles,
  TrendingUp,
  FileCode,
  Shield,
  ShieldOff,
  Zap,
  Terminal,
  Radio,
  Wifi,
  Thermometer,
  Clock,
  RotateCcw
} from 'lucide-react';

import { DigitalTwin } from './components/DigitalTwin';
import { LaserProfiler } from './components/LaserProfiler';
import { JointTracker } from './components/JointTracker';
import { MarkingControllerView } from './components/MarkingControllerView';
import { GeminiDiagnostics } from './components/GeminiDiagnostics';
import { PredictiveRulChart } from './components/PredictiveRulChart';
import { FirmwareExplorer } from './components/FirmwareExplorer';
import { HardwareWiringDiagram } from './components/HardwareWiringDiagram';
import { ApiTestBench } from './components/ApiTestBench';
import { TelemetryData, DefectItem, JointStatusData, PredictiveMaintenanceData, AIAnalysisReport } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'twin' | 'laser' | 'joint' | 'predictive' | 'ai' | 'firmware' | 'wiring' | 'api'>('twin');

  // Core State
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    timestamp: Date.now(),
    beltRunning: true,
    beltSpeedMps: 0.85,
    beltRpm: 12.75,
    revCount: 18,
    lastJointTimestamp: Date.now() - 2100,
    laserBaselineCalibrated: true,
    scaleFactorMmPerPx: 0.22,
    cameraFps: 28.5,
    servoArmed: true,
    markingCooldownMs: 1500,
    markingNozzleDistanceMm: 1200,
    memoryFreeBytes: 114280,
    wifiRssi: -58,
    tempDegC: 44.2,
  });

  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [jointStatus, setJointStatus] = useState<JointStatusData>({
    revolutionCount: 18,
    lastPulseTimestamp: Date.now() - 2100,
    timeSinceLastPulseMs: 2100,
    revPeriodMs: 4700,
    beltRpm: 12.75,
    beltSpeedMps: 0.85,
    currentPhaseDeg: 160.8,
    jointDefectsCount: 2,
    jointConditionRating: 'MONITORED_DEGRADATION',
    spliceSafetyMarginPercent: 68.0,
  });

  const [predictiveData, setPredictiveData] = useState<PredictiveMaintenanceData>({
    dataSufficient: true,
    sampleCount: 4,
    criticalThresholdMm: 8.0,
    currentMaxDeviationMm: 7.22,
    degradationRateMmPerRev: 0.35,
    estimatedRevolutionsRemaining: 2,
    estimatedHoursRemaining: 0.3,
    confidenceScore: 0.88,
    warningMessage: 'CRITICAL: Joint degradation rate exceeds DIN 22102 safety margin. Imminent splice failure predicted within ~12 operating hours.',
    trends: [
      { revolution: 12, deviationMm: 5.81, timestamp: Date.now() - 145000 },
      { revolution: 14, deviationMm: 6.20, timestamp: Date.now() - 95000 },
      { revolution: 16, deviationMm: 7.22, timestamp: Date.now() - 42000 },
    ],
  });

  const [isMarkingActuating, setIsMarkingActuating] = useState(false);

  // Fetch initial telemetry and defects from server
  const refreshData = useCallback(async () => {
    try {
      const [tRes, dRes, jRes, pRes] = await Promise.all([
        fetch('/api/telemetry').then((r) => r.json()).catch(() => null),
        fetch('/api/defects?limit=50').then((r) => r.json()).catch(() => null),
        fetch('/api/joint-status').then((r) => r.json()).catch(() => null),
        fetch('/api/predictive-maintenance').then((r) => r.json()).catch(() => null),
      ]);

      if (tRes) setTelemetry((prev) => ({ ...prev, ...tRes }));
      if (dRes && Array.isArray(dRes)) setDefects(dRes);
      if (jRes) setJointStatus(jRes);
      if (pRes) setPredictiveData(pRes);
    } catch (e) {
      console.warn('API sync warning:', e);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Handlers
  const handleToggleBelt = () => {
    const nextState = !telemetry.beltRunning;
    setTelemetry((prev) => ({ ...prev, beltRunning: nextState }));
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beltRunning: nextState }),
    }).catch(console.error);
  };

  const handleUpdateSpeed = (newSpeed: number) => {
    const newRpm = (newSpeed / 0.85) * 12.75;
    setTelemetry((prev) => ({ ...prev, beltSpeedMps: newSpeed, beltRpm: newRpm }));
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beltSpeedMps: newSpeed, beltRpm: newRpm }),
    }).catch(console.error);
  };

  const handleToggleArm = async () => {
    const willArm = !telemetry.servoArmed;
    setTelemetry((prev) => ({ ...prev, servoArmed: willArm }));
    const endpoint = willArm ? '/api/marking/enable' : '/api/marking/disable';
    await fetch(endpoint, { method: 'POST' });
  };

  const handleTriggerTest = async () => {
    setIsMarkingActuating(true);
    await fetch('/api/marking/trigger-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angle: 65, pulseMs: 350 }),
    });
    setTimeout(() => {
      setIsMarkingActuating(false);
    }, 400);
  };

  const handleInjectDefect = async (defectData: Partial<DefectItem>) => {
    const newDef: DefectItem = {
      id: defectData.id || `DEF-${Date.now().toString().slice(-4)}`,
      timestamp: Date.now(),
      revolution: telemetry.revCount,
      phaseAngleDeg: defectData.phaseAngleDeg || (jointStatus.currentPhaseDeg || 14.5),
      distanceFromJointMm: defectData.distanceFromJointMm || 168.0,
      laserDeviationPx: defectData.laserDeviationPx || 32.8,
      laserDeviationMm: defectData.laserDeviationMm || 7.22,
      widthMm: defectData.widthMm || 22.0,
      lengthMm: defectData.lengthMm || 58.0,
      severity: defectData.severity || 'CRITICAL',
      confidence: defectData.confidence || 0.96,
      isJointAssociated: !!defectData.isJointAssociated,
      marked: false,
      defectType: defectData.defectType || 'SPLICE_SPLIT',
    };

    // Calculate physical transit delay: D / v
    const delayMs = Math.round((telemetry.markingNozzleDistanceMm / (telemetry.beltSpeedMps * 1000)) * 1000);

    // If critical and armed, schedule servo marking visual actuation
    if (telemetry.servoArmed && (newDef.severity === 'CRITICAL' || (newDef.severity === 'HIGH' && newDef.isJointAssociated))) {
      setTimeout(() => {
        setIsMarkingActuating(true);
        setTimeout(() => setIsMarkingActuating(false), 380);
      }, delayMs);
    }

    try {
      const res = await fetch('/api/defects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDef),
      });
      const data = await res.json();
      if (data.defect) {
        setDefects((prev) => [...prev, data.defect]);
      } else {
        setDefects((prev) => [...prev, newDef]);
      }
      refreshData();
    } catch (e) {
      setDefects((prev) => [...prev, newDef]);
    }
  };

  const handleCalibrate = async (scaleFactorMmPerPx: number) => {
    setTelemetry((prev) => ({ ...prev, scaleFactorMmPerPx }));
    await fetch('/api/calibrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scaleFactorMmPerPx }),
    });
  };

  const handleUpdateNozzleDistance = async (distanceMm: number) => {
    setTelemetry((prev) => ({ ...prev, markingNozzleDistanceMm: distanceMm }));
    await fetch('/api/calibrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nozzleDistanceMm: distanceMm }),
    });
  };

  const handleTriggerGeminiAnalysis = async (notes: string): Promise<AIAnalysisReport | null> => {
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextNotes: notes }),
    });
    const data = await res.json();
    return data.report || null;
  };

  const latestDefect = defects.length > 0 ? defects[defects.length - 1] : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Header & Telemetry Status Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-lg">
              B
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-slate-100">
                  BeltGuard AI <span className="text-xs text-indigo-400 font-mono">v2.4</span>
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ESP32-CAM ONLINE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Laser Triangulation • Inductive Joint Sync • Gemini Diagnostics • Local Marking
              </p>
            </div>
          </div>

          {/* Controller Quick Stats */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400">FPS:</span>
              <span className="font-bold text-slate-200">{telemetry.cameraFps.toFixed(1)}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <Wifi className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">RSSI:</span>
              <span className="font-bold text-slate-200">{telemetry.wifiRssi} dBm</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Core:</span>
              <span className="font-bold text-slate-200">{telemetry.tempDegC.toFixed(1)}°C</span>
            </div>

            {/* Arm Button */}
            <button
              onClick={handleToggleArm}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition border ${
                telemetry.servoArmed
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
              }`}
            >
              {telemetry.servoArmed ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
              {telemetry.servoArmed ? 'MARKER ARMED' : 'EMERGENCY LOCKOUT'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-5 flex-1 w-full space-y-5">
        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-1 border-b border-slate-800 pb-2 text-xs font-medium no-scrollbar">
          <button
            onClick={() => setActiveTab('twin')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'twin'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Digital Twin & Visualizer
          </button>

          <button
            onClick={() => setActiveTab('laser')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'laser'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Laser Profiler & Optics
          </button>

          <button
            onClick={() => setActiveTab('joint')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'joint'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Joint Tracking & Sensor Fusion
          </button>

          <button
            onClick={() => setActiveTab('predictive')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'predictive'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Predictive RUL Model
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Gemini AI Diagnostics
          </button>

          <button
            onClick={() => setActiveTab('firmware')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'firmware'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Firmware & Python Backend
          </button>

          <button
            onClick={() => setActiveTab('wiring')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'wiring'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Hardware Schematics
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'api'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            API Test Bench
          </button>
        </div>

        {/* Dynamic Tab Body */}
        {activeTab === 'twin' && (
          <div className="space-y-5">
            <DigitalTwin
              telemetry={telemetry}
              defects={defects}
              onInjectDefect={handleInjectDefect}
              onToggleBelt={handleToggleBelt}
              onUpdateSpeed={handleUpdateSpeed}
              isMarkingActuating={isMarkingActuating}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <LaserProfiler
                telemetry={telemetry}
                latestDefect={latestDefect}
                onCalibrate={handleCalibrate}
              />
              <MarkingControllerView
                telemetry={telemetry}
                isMarkingActuating={isMarkingActuating}
                onToggleArm={handleToggleArm}
                onTriggerTest={handleTriggerTest}
                onUpdateNozzleDistance={handleUpdateNozzleDistance}
              />
            </div>
          </div>
        )}

        {activeTab === 'laser' && (
          <div className="space-y-5">
            <LaserProfiler
              telemetry={telemetry}
              latestDefect={latestDefect}
              onCalibrate={handleCalibrate}
            />

            {/* Defect Records Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
              <h3 className="font-bold text-slate-100 text-sm mb-3">
                Detected Defect Inspection Log ({defects.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-2.5">ID</th>
                      <th className="p-2.5">Rev</th>
                      <th className="p-2.5">Phase (Deg)</th>
                      <th className="p-2.5">Splice Dist (mm)</th>
                      <th className="p-2.5">Laser Dev (mm)</th>
                      <th className="p-2.5">Severity</th>
                      <th className="p-2.5">Confidence</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Marking</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {defects.slice(-10).reverse().map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-slate-200">{d.id}</td>
                        <td className="p-2.5">{d.revolution}</td>
                        <td className="p-2.5">{d.phaseAngleDeg.toFixed(1)}°</td>
                        <td className="p-2.5">{d.distanceFromJointMm.toFixed(0)} mm</td>
                        <td className="p-2.5 font-bold text-amber-400">{d.laserDeviationMm.toFixed(2)} mm</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                            d.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-blue-500/20 text-blue-300'
                          }`}>
                            {d.severity}
                          </span>
                        </td>
                        <td className="p-2.5">{(d.confidence * 100).toFixed(0)}%</td>
                        <td className="p-2.5 text-slate-300">{d.defectType}</td>
                        <td className="p-2.5">
                          {d.marked ? (
                            <span className="text-emerald-400 font-bold">✓ Sprayed</span>
                          ) : (
                            <span className="text-slate-500">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'joint' && (
          <div className="space-y-5">
            <JointTracker
              telemetry={telemetry}
              jointStatus={jointStatus}
              defects={defects}
            />
          </div>
        )}

        {activeTab === 'predictive' && (
          <div className="space-y-5">
            <PredictiveRulChart data={predictiveData} />
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-5">
            <GeminiDiagnostics
              telemetry={telemetry}
              defects={defects}
              onTriggerAnalysis={handleTriggerGeminiAnalysis}
            />
          </div>
        )}

        {activeTab === 'firmware' && (
          <div className="space-y-5">
            <FirmwareExplorer />
          </div>
        )}

        {activeTab === 'wiring' && (
          <div className="space-y-5">
            <HardwareWiringDiagram />
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-5">
            <ApiTestBench />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-3 text-center text-xs text-slate-500 font-mono">
        BeltGuard AI • ESP32-CAM Laser Triangulation & Gemini Reliability Suite • DIN 22102 / ISO 15236 Compliant
      </footer>
    </div>
  );
}
