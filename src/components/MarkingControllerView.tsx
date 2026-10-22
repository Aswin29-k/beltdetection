import React, { useState } from 'react';
import { Target, Shield, ShieldOff, PlayCircle, Clock, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import { TelemetryData } from '../types';

interface MarkingControllerViewProps {
  telemetry: TelemetryData;
  isMarkingActuating: boolean;
  onToggleArm: () => void;
  onTriggerTest: () => void;
  onUpdateNozzleDistance: (distanceMm: number) => void;
}

export const MarkingControllerView: React.FC<MarkingControllerViewProps> = ({
  telemetry,
  isMarkingActuating,
  onToggleArm,
  onTriggerTest,
  onUpdateNozzleDistance,
}) => {
  const [distanceMm, setDistanceMm] = useState(telemetry.markingNozzleDistanceMm);
  const transitDelaySec = telemetry.beltSpeedMps > 0 ? (distanceMm / 1000) / telemetry.beltSpeedMps : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-slate-100 text-sm">
            Deterministic SG90 Marking Controller & Transit Delay
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleArm}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition border ${
              telemetry.servoArmed
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
            }`}
          >
            {telemetry.servoArmed ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
            {telemetry.servoArmed ? 'ARMED' : 'SAFETY DISARMED'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
        {/* Physical Station Parameters */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Speed-Compensated Transit Lag
          </h4>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Camera-to-Nozzle Distance (D):</span>
              <span className="font-mono font-bold text-slate-200">{distanceMm} mm</span>
            </div>
            <input
              type="range"
              min="500"
              max="3000"
              step="50"
              value={distanceMm}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setDistanceMm(val);
                onUpdateNozzleDistance(val);
              }}
              className="w-full accent-amber-500 cursor-pointer h-1.5"
            />
          </div>

          <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Belt Velocity:</span>
              <span className="font-mono text-slate-200">{telemetry.beltSpeedMps.toFixed(2)} m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Transit Delay (T = D / v):</span>
              <span className="font-mono font-bold text-amber-400">{transitDelaySec.toFixed(3)} s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cooldown Lockout:</span>
              <span className="font-mono text-slate-300">{telemetry.markingCooldownMs} ms</span>
            </div>
          </div>
        </div>

        {/* Servo Actuator Status Gauge */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col items-center justify-center text-center">
          <div className={`p-3 rounded-full border-2 transition-all duration-200 mb-2 ${
            isMarkingActuating
              ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-lg shadow-amber-400/40 animate-pulse'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}>
            <Zap className="w-8 h-8" />
          </div>

          <span className="text-xs text-slate-400">Actuator State:</span>
          <p className={`text-sm font-mono font-bold ${isMarkingActuating ? 'text-amber-400' : 'text-slate-300'}`}>
            {isMarkingActuating ? 'ACTUATING NOZZLE (65°)' : 'REST SAFE POSITION (0°)'}
          </p>

          <span className="text-[11px] text-slate-500 mt-1 font-mono">
            PWM: GPIO 13 • 50 Hz • 16-bit LEDC
          </span>
        </div>

        {/* Manual Test & Safety Rules */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
              <PlayCircle className="w-3.5 h-3.5 text-indigo-400" /> Dry-Run Test Bench
            </h4>
            <p className="text-[11px] text-slate-400 mt-2">
              Tests the SG90 servo rotation, linkage rod, and aerosol valve stroke without discharging paint.
            </p>
          </div>

          <div className="space-y-2 mt-3">
            <button
              onClick={onTriggerTest}
              disabled={!telemetry.servoArmed}
              className="w-full py-2 bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-40 text-amber-300 rounded text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Zap className="w-3.5 h-3.5" />
              Trigger Dry-Run Test Pulse (300ms)
            </button>

            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Independent local execution — does not depend on cloud AI.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
