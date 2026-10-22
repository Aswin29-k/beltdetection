import React from 'react';
import { Compass, RotateCw, ShieldCheck, AlertTriangle, Layers, MapPin } from 'lucide-react';
import { DefectItem, JointStatusData, TelemetryData } from '../types';

interface JointTrackerProps {
  telemetry: TelemetryData;
  jointStatus: JointStatusData;
  defects: DefectItem[];
}

export const JointTracker: React.FC<JointTrackerProps> = ({
  telemetry,
  jointStatus,
  defects,
}) => {
  const jointDefects = defects.filter((d) => d.isJointAssociated);
  const phaseAngle = jointStatus.currentPhaseDeg || 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-sky-400" />
          <h3 className="font-bold text-slate-100 text-sm">
            Vulcanized Joint Tracking & Sensor Fusion
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono">
            Target: 316-SS Embedded Shim
          </span>
          <span className={`text-xs px-2.5 py-1 rounded font-semibold ${
            jointStatus.jointConditionRating === 'CRITICAL_RISK'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          }`}>
            Condition: {jointStatus.jointConditionRating || 'HEALTHY'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Phase Dial & Revolution Timing */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Outer Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
            
            {/* Splice Joint Reference Indicator (0 deg) */}
            <div className="absolute top-0 w-3 h-3 bg-amber-400 rounded-full shadow-lg shadow-amber-400/50" />
            <span className="absolute -top-5 text-[10px] font-mono text-amber-400 font-bold">SPLICE (0°)</span>

            {/* Rotating Phase Needle */}
            <div
              className="absolute w-1 h-14 bg-sky-400 rounded-full origin-bottom transition-transform duration-200 shadow-md shadow-sky-400/50"
              style={{
                transform: `rotate(${phaseAngle}deg) translateY(-50%)`,
                top: '50%',
                left: 'calc(50% - 2px)',
              }}
            />

            {/* Center Hub */}
            <div className="w-6 h-6 rounded-full bg-slate-900 border-2 border-sky-400 z-10 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            </div>
          </div>

          <div className="mt-3 text-center">
            <span className="text-xs text-slate-400">Current Rotational Phase:</span>
            <p className="text-lg font-mono font-bold text-sky-400">{phaseAngle.toFixed(1)}°</p>
          </div>
        </div>

        {/* Speed & Proximity Timing Metrics */}
        <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
          <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
            <RotateCw className="w-3.5 h-3.5 text-sky-400" /> Monotonic Timing & Velocity
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400">Rev Period (T):</span>
              <p className="font-mono font-bold text-slate-200">{jointStatus.revPeriodMs || 4700} ms</p>
            </div>
            <div>
              <span className="text-slate-400">Shaft RPM:</span>
              <p className="font-mono font-bold text-slate-200">{telemetry.beltRpm.toFixed(1)} RPM</p>
            </div>
            <div>
              <span className="text-slate-400">Linear Velocity:</span>
              <p className="font-mono font-bold text-slate-200">{telemetry.beltSpeedMps.toFixed(2)} m/s</p>
            </div>
            <div>
              <span className="text-slate-400">Total Revolutions:</span>
              <p className="font-mono font-bold text-indigo-400">{telemetry.revCount} revs</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Splice Safety Margin:</span>
              <span className="font-bold text-emerald-400">{jointStatus.spliceSafetyMarginPercent || 85}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  (jointStatus.spliceSafetyMarginPercent || 85) < 40 ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${jointStatus.spliceSafetyMarginPercent || 85}%` }}
              />
            </div>
          </div>
        </div>

        {/* Joint-Associated Defect Growth */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" /> Joint-Adjacent Flaws ({jointDefects.length})
          </h4>

          {jointDefects.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              <ShieldCheck className="w-8 h-8 text-emerald-500/40 mx-auto mb-1" />
              No structural defects detected within splice zone (±300mm).
            </div>
          ) : (
            <div className="space-y-2 mt-2 max-h-36 overflow-y-auto pr-1">
              {jointDefects.map((d) => (
                <div
                  key={d.id}
                  className="bg-slate-900/80 p-2 rounded border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold text-slate-200">{d.id}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                        +{d.distanceFromJointMm.toFixed(0)}mm
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Rev {d.revolution} • {d.defectType}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className={`text-[11px] font-mono font-bold ${
                      d.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {d.laserDeviationMm.toFixed(2)} mm
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {d.marked ? '📍 Marked' : 'Unmarked'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 1D Unrolled Belt Spatial Map */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-sky-400" /> Unrolled Belt Coordinate Map (0 to 12,000 mm)
          </span>
          <span className="font-mono text-[11px]">
            Current Scanner Position: <strong>{((phaseAngle / 360) * 12000).toFixed(0)} mm</strong>
          </span>
        </div>

        <div className="relative w-full h-7 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
          {/* Splice zone indicator at 0 mm and 12,000 mm */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-amber-500/20 border-r border-amber-500/40" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-amber-500/20 border-l border-amber-500/40" />

          {/* Current laser scanner indicator */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-sky-400 shadow-md shadow-sky-400/80 transition-all duration-150"
            style={{ left: `${(phaseAngle / 360) * 100}%` }}
          />

          {/* Render defects on map */}
          {defects.map((d) => {
            const leftPct = (d.distanceFromJointMm / 12000) * 100;
            return (
              <div
                key={d.id}
                title={`${d.id}: ${d.laserDeviationMm.toFixed(2)}mm (${d.severity})`}
                className={`absolute top-1.5 bottom-1.5 w-2 rounded-full cursor-pointer hover:scale-125 transition-transform ${
                  d.severity === 'CRITICAL' ? 'bg-rose-500 ring-2 ring-rose-400/50' : d.severity === 'HIGH' ? 'bg-amber-400' : 'bg-blue-400'
                }`}
                style={{ left: `calc(${leftPct}% - 4px)` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
