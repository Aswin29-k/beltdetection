import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, AlertTriangle, Crosshair, Sparkles, ShieldAlert, Cpu } from 'lucide-react';
import { DefectItem, DefectType, TelemetryData } from '../types';

interface DigitalTwinProps {
  telemetry: TelemetryData;
  defects: DefectItem[];
  onInjectDefect: (defect: Partial<DefectItem>) => void;
  onToggleBelt: () => void;
  onUpdateSpeed: (speed: number) => void;
  isMarkingActuating: boolean;
}

export const DigitalTwin: React.FC<DigitalTwinProps> = ({
  telemetry,
  defects,
  onInjectDefect,
  onToggleBelt,
  onUpdateSpeed,
  isMarkingActuating,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [injectedCount, setInjectedCount] = useState(0);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let beltOffset = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Grid background
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Conveyor Structure Dimensions
      const loopLeft = 70;
      const loopRight = width - 70;
      const topY = 90;
      const bottomY = 170;
      const rollerRadius = 40;

      // Update belt motion
      if (telemetry.beltRunning) {
        beltOffset = (beltOffset + telemetry.beltSpeedMps * 2.2) % 360;
      }

      // 1. Draw Rollers
      const drawRoller = (x: number, y: number) => {
        // Outer rim
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(x, y, rollerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#64748b';
        ctx.stroke();

        // Hub & Spokes
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();

        // Spokes rotating
        const rotAngle = (beltOffset * Math.PI) / 60;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = rotAngle + (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * rollerRadius, y + Math.sin(a) * rollerRadius);
          ctx.stroke();
        }
      };

      drawRoller(loopLeft, (topY + bottomY) / 2);
      drawRoller(loopRight, (topY + bottomY) / 2);

      // Intermediate support idler rollers
      const idlerY = topY + 12;
      for (let ix = loopLeft + 120; ix < loopRight - 40; ix += 140) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(ix, idlerY + 14, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.stroke();
      }

      // 2. Draw Conveyor Belt Loop
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#1e293b'; // Belt rubber backing
      ctx.beginPath();
      // Top strand
      ctx.moveTo(loopLeft, topY);
      ctx.lineTo(loopRight, topY);
      // Right loop
      ctx.arc(loopRight, (topY + bottomY) / 2, rollerRadius, -Math.PI / 2, Math.PI / 2);
      // Bottom strand
      ctx.lineTo(loopLeft, bottomY);
      // Left loop
      ctx.arc(loopLeft, (topY + bottomY) / 2, rollerRadius, Math.PI / 2, -Math.PI / 2);
      ctx.stroke();

      // Belt textured ribs (moving dashes)
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#334155';
      ctx.setLineDash([14, 18]);
      ctx.lineDashOffset = -beltOffset * 1.5;
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // 3. Vulcanized Joint with Metallic Flag
      const jointLoopPos = (beltOffset * 2.5) % 1000;
      let jointX = 0;
      let jointY = 0;
      const strandLen = loopRight - loopLeft;

      if (jointLoopPos < strandLen) {
        // On top strand moving left to right
        jointX = loopLeft + jointLoopPos;
        jointY = topY;
      } else if (jointLoopPos < strandLen + 120) {
        // On right curve
        const curveFrac = (jointLoopPos - strandLen) / 120;
        const angle = -Math.PI / 2 + curveFrac * Math.PI;
        jointX = loopRight + Math.cos(angle) * rollerRadius;
        jointY = (topY + bottomY) / 2 + Math.sin(angle) * rollerRadius;
      } else if (jointLoopPos < strandLen * 2 + 120) {
        // On bottom strand moving right to left
        const botFrac = (jointLoopPos - (strandLen + 120)) / strandLen;
        jointX = loopRight - botFrac * strandLen;
        jointY = bottomY;
      } else {
        // On left curve
        const curveFrac = (jointLoopPos - (strandLen * 2 + 120)) / 120;
        const angle = Math.PI / 2 + curveFrac * Math.PI;
        jointX = loopLeft + Math.cos(angle) * rollerRadius;
        jointY = (topY + bottomY) / 2 + Math.sin(angle) * rollerRadius;
      }

      // Draw Vulcanized Joint Splice pattern
      ctx.save();
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(jointX, jointY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Embedded stainless steel target flag
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(jointX - 2, jointY - 8, 4, 16);
      ctx.restore();

      // 4. Station A: Inductive Proximity Sensor (at x = 160)
      const proxSensorX = loopLeft + 100;
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(proxSensorX - 8, topY - 38, 16, 26);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(proxSensorX - 8, topY - 38, 16, 26);

      // Sensor face sensing zone
      const isJointNearSensor = Math.abs(jointX - proxSensorX) < 18 && jointY === topY;
      ctx.fillStyle = isJointNearSensor ? '#22c55e' : '#0284c7';
      ctx.beginPath();
      ctx.arc(proxSensorX, topY - 12, 4, 0, Math.PI * 2);
      ctx.fill();

      // Sensor sensing field
      if (isJointNearSensor) {
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.beginPath();
        ctx.arc(proxSensorX, topY - 8, 12, 0, Math.PI);
        ctx.stroke();
      }

      // Station label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('INDUCTIVE SENSOR', proxSensorX, topY - 44);
      ctx.fillText('(GPIO 12 Opto)', proxSensorX, topY - 56);

      // 5. Station B: ESP32-CAM & Laser Triangulation Head (at x = 360)
      const camX = loopLeft + 300;
      // Camera enclosure
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.fillRect(camX - 22, topY - 60, 44, 30);
      ctx.strokeRect(camX - 22, topY - 60, 44, 30);

      // Lens
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(camX, topY - 30, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#818cf8';
      ctx.stroke();

      // Laser Diode (mounted angled at 45 deg)
      const laserX = camX + 28;
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(laserX - 6, topY - 50, 12, 16);
      ctx.strokeStyle = '#ef4444';
      ctx.strokeRect(laserX - 6, topY - 50, 12, 16);

      // Red Laser Triangulation Sheet Projected onto Belt
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(laserX, topY - 34);
      ctx.lineTo(camX, topY);
      ctx.stroke();

      // Laser stripe line glow on belt
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(camX - 12, topY);
      ctx.lineTo(camX + 12, topY);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ESP32-CAM + LASER', camX + 10, topY - 68);
      ctx.fillText('45° Triangulation', camX + 10, topY - 78);

      // 6. Station C: Downstream SG90 Servo Actuator & Marking Nozzle (at x = 580)
      const markerX = loopLeft + 520;
      // Distance ruler indicator between camera and marker
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(camX, topY - 14);
      ctx.lineTo(markerX, topY - 14);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '9px monospace';
      ctx.fillText(`D = ${telemetry.markingNozzleDistanceMm} mm (Transit Lag)`, (camX + markerX) / 2, topY - 18);

      // Aerosol Spray Canister
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(markerX - 12, topY - 55, 24, 38);
      ctx.strokeStyle = '#fdba74';
      ctx.strokeRect(markerX - 12, topY - 55, 24, 38);

      // SG90 Micro Servo Arm
      const servoAngle = isMarkingActuating ? 65 : 0;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(markerX + 14, topY - 48, 14, 18); // servo body

      // Servo arm pressing valve
      ctx.strokeStyle = isMarkingActuating ? '#fbbf24' : '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(markerX + 14, topY - 40);
      if (isMarkingActuating) {
        ctx.lineTo(markerX, topY - 48); // depressed
      } else {
        ctx.lineTo(markerX + 4, topY - 58); // retracted
      }
      ctx.stroke();

      // Spray Nozzle Aerosol Burst if Actuating
      if (isMarkingActuating) {
        ctx.save();
        ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
        ctx.beginPath();
        ctx.moveTo(markerX, topY - 17);
        ctx.lineTo(markerX - 14, topY);
        ctx.lineTo(markerX + 14, topY);
        ctx.closePath();
        ctx.fill();

        // High visibility spot marked on belt
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(markerX, topY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = telemetry.servoArmed ? '#22c55e' : '#ef4444';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SG90 MARKER', markerX, topY - 64);
      ctx.fillText(telemetry.servoArmed ? '[ARMED]' : '[DISARMED]', markerX, topY - 74);

      // 7. Render Active Defects Traveling along belt
      defects.slice(-6).forEach((d, idx) => {
        // Calculate dynamic position based on elapsed time
        const elapsedSec = (Date.now() - d.timestamp) / 1000;
        const distTraveledMm = elapsedSec * telemetry.beltSpeedMps * 1000;
        const currentPosOnStrand = (distTraveledMm % 12000) / 10; // scale to canvas

        if (currentPosOnStrand >= 0 && currentPosOnStrand <= strandLen) {
          const dx = loopLeft + currentPosOnStrand;
          ctx.fillStyle = d.severity === 'CRITICAL' ? '#ef4444' : d.severity === 'HIGH' ? '#f59e0b' : '#3b82f6';
          ctx.beginPath();
          ctx.arc(dx, topY, 5, 0, Math.PI * 2);
          ctx.fill();

          // Physical paint mark if marked
          if (d.marked) {
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(dx, topY, 9, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.fillStyle = '#f8fafc';
          ctx.font = '9px monospace';
          ctx.fillText(d.id, dx, topY + 16);
        }
      });

      // 8. Legend & Live Status Overlay
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(16, height - 36, width - 32, 28);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(16, height - 36, width - 32, 28);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Belt: ${telemetry.beltSpeedMps.toFixed(2)} m/s | RPM: ${telemetry.beltRpm.toFixed(1)} | Rev: ${telemetry.revCount} | Joint: 0.5mm 316-SS shim | Laser: 650nm @ 45° | Marker: D = 1200mm (Lag = ${(1.2 / telemetry.beltSpeedMps).toFixed(2)}s)`, 26, height - 18);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [telemetry, defects, isMarkingActuating]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Conveyor Belt Digital Twin & Triangulation Scanner
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${telemetry.beltRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            </h2>
            <p className="text-xs text-slate-400">
              Real-time closed-loop simulation matching ESP32-CAM physical testbed
            </p>
          </div>
        </div>

        {/* Speed & Run Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400">Belt Speed:</span>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.05"
              value={telemetry.beltSpeedMps}
              onChange={(e) => onUpdateSpeed(parseFloat(e.target.value))}
              className="w-24 accent-indigo-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-indigo-400 w-16">
              {telemetry.beltSpeedMps.toFixed(2)} m/s
            </span>
          </div>

          <button
            onClick={onToggleBelt}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              telemetry.beltRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
            }`}
          >
            {telemetry.beltRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {telemetry.beltRunning ? 'Halt Conveyor' : 'Run Conveyor'}
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative mt-3 rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
        <canvas ref={canvasRef} width={820} height={230} className="w-full h-auto block" />
      </div>

      {/* Defect Injection Tool Bench */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300">Inject Test Defect into Scanner:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setInjectedCount((c) => c + 1);
              onInjectDefect({
                id: `DEF-SPLICE-${Date.now().toString().slice(-4)}`,
                defectType: 'SPLICE_SPLIT',
                severity: 'CRITICAL',
                isJointAssociated: true,
                distanceFromJointMm: 168.0,
                laserDeviationPx: 32.8,
                laserDeviationMm: 7.22,
                widthMm: 22.0,
                lengthMm: 58.0,
                confidence: 0.96,
              });
            }}
            className="px-2.5 py-1 bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-rose-300 text-xs rounded transition flex items-center gap-1"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Splice Split (7.2mm, Critical)
          </button>

          <button
            onClick={() => {
              setInjectedCount((c) => c + 1);
              onInjectDefect({
                id: `DEF-VOID-${Date.now().toString().slice(-4)}`,
                defectType: 'PUNCTURE',
                severity: 'CRITICAL',
                isJointAssociated: false,
                distanceFromJointMm: 3400.0,
                laserDeviationPx: 29.5,
                laserDeviationMm: 6.49,
                widthMm: 15.0,
                lengthMm: 18.0,
                confidence: 0.95,
              });
            }}
            className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 text-xs rounded transition"
          >
            Puncture Void (6.5mm, Critical)
          </button>

          <button
            onClick={() => {
              setInjectedCount((c) => c + 1);
              onInjectDefect({
                id: `DEF-TEAR-${Date.now().toString().slice(-4)}`,
                defectType: 'TEAR',
                severity: 'HIGH',
                isJointAssociated: false,
                distanceFromJointMm: 6800.0,
                laserDeviationPx: 18.5,
                laserDeviationMm: 4.07,
                widthMm: 10.0,
                lengthMm: 35.0,
                confidence: 0.91,
              });
            }}
            className="px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 text-xs rounded transition"
          >
            Longitudinal Slit (4.1mm, High)
          </button>

          <button
            onClick={() => {
              setInjectedCount((c) => c + 1);
              onInjectDefect({
                id: `DEF-GOUGE-${Date.now().toString().slice(-4)}`,
                defectType: 'SURFACE_GOUGE',
                severity: 'MEDIUM',
                isJointAssociated: false,
                distanceFromJointMm: 9200.0,
                laserDeviationPx: 12.0,
                laserDeviationMm: 2.64,
                widthMm: 8.0,
                lengthMm: 14.0,
                confidence: 0.88,
              });
            }}
            className="px-2.5 py-1 bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 text-blue-300 text-xs rounded transition"
          >
            Surface Gouge (2.6mm, Med)
          </button>
        </div>
      </div>
    </div>
  );
};
