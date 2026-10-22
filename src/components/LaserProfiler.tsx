import React, { useState, useEffect, useRef } from 'react';
import { Camera, Sliders, RefreshCw, CheckCircle2, AlertOctagon, Activity } from 'lucide-react';
import { DefectItem, TelemetryData } from '../types';

interface LaserProfilerProps {
  telemetry: TelemetryData;
  latestDefect?: DefectItem;
  onCalibrate: (scaleFactorMmPerPx: number) => void;
}

export const LaserProfiler: React.FC<LaserProfilerProps> = ({
  telemetry,
  latestDefect,
  onCalibrate,
}) => {
  const [scaleFactor, setScaleFactor] = useState(telemetry.scaleFactorMmPerPx);
  const [laserAngle, setLaserAngle] = useState(45.0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationSuccess, setCalibrationSuccess] = useState(false);
  const plotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const camFeedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync state if telemetry updates
  useEffect(() => {
    setScaleFactor(telemetry.scaleFactorMmPerPx);
  }, [telemetry.scaleFactorMmPerPx]);

  // Render Laser Profile Plot
  useEffect(() => {
    const canvas = plotCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const baselineY = 60;
    const maxPlotHeightPx = h - 40;

    // 1. Draw Calibrated Baseline (Green dashed line)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, baselineY);
    ctx.lineTo(w - 20, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Critical DIN 22102 Carcass Exposure Limit (Red dashed line)
    // 6.0 mm / scaleFactor = critical pixel displacement
    const criticalPx = 6.0 / scaleFactor;
    const criticalY = baselineY + criticalPx * 1.8;
    if (criticalY < h - 10) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(30, criticalY);
      ctx.lineTo(w - 20, criticalY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ef4444';
      ctx.font = '10px monospace';
      ctx.fillText('CRITICAL THRESHOLD (6.0 mm Cord Exposure Limit)', 40, criticalY - 6);
    }

    // 3. Current Extracted Laser Stripe Profile
    const peakDevPx = latestDefect ? latestDefect.laserDeviationPx : 0;
    const centerCol = 160;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    const points: Array<[number, number]> = [];
    for (let col = 0; col < 320; col += 2) {
      const pxX = 30 + (col / 320) * (w - 50);
      let dev = 0;
      if (latestDefect && latestDefect.laserDeviationPx > 0) {
        // Gaussian bump at defect position
        const dist = col - centerCol;
        dev = peakDevPx * Math.exp(-(dist * dist) / (2 * 12 * 12));
      }
      // Add subtle belt surface roughness vibration (+- 0.5 px)
      const noise = (Math.sin(col * 0.4) + Math.cos(col * 0.15)) * 0.4;
      const pxY = baselineY + (dev + noise) * 1.8;
      points.push([pxX, pxY]);

      if (col === 0) {
        ctx.moveTo(pxX, pxY);
      } else {
        ctx.lineTo(pxX, pxY);
      }
    }
    ctx.stroke();

    // Fill under curve
    if (latestDefect && latestDefect.laserDeviationPx > 3) {
      ctx.lineTo(w - 20, baselineY);
      ctx.lineTo(30, baselineY);
      ctx.fillStyle = latestDefect.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.12)';
      ctx.fill();
    }

    // Subpixel centroid indicator
    if (latestDefect && latestDefect.laserDeviationPx > 0) {
      const peakX = 30 + (centerCol / 320) * (w - 50);
      const peakY = baselineY + peakDevPx * 1.8;

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(peakX, peakY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Peak label
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`ΔZ = ${(peakDevPx * scaleFactor).toFixed(2)} mm (${peakDevPx.toFixed(1)} px)`, peakX - 50, peakY + 20);
    }

    // Axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText('0 px (Belt Left)', 30, h - 10);
    ctx.fillText('160 px (Center)', w / 2 - 35, h - 10);
    ctx.fillText('320 px (Belt Right)', w - 100, h - 10);
  }, [latestDefect, scaleFactor]);

  // Render Simulated ESP32-CAM Camera Frame (320x240 Grayscale)
  useEffect(() => {
    const canvas = camFeedCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Dark conveyor belt background with low ambient light
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);

    // Subtle belt longitudinal texture
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let y = 10; y < h; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Red Laser Line Stripe across field of view
    const baseY = h / 2;
    const peakDevPx = latestDefect ? latestDefect.laserDeviationPx * 0.75 : 0;
    const centerCol = w / 2;

    ctx.save();
    ctx.shadowColor = '#ff2222';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      let dev = 0;
      if (latestDefect && latestDefect.laserDeviationPx > 0) {
        const dist = x - centerCol;
        dev = peakDevPx * Math.exp(-(dist * dist) / (2 * 10 * 10));
      }
      const y = baseY + dev + (Math.random() - 0.5) * 0.8;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Intense inner core of laser
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      let dev = 0;
      if (latestDefect && latestDefect.laserDeviationPx > 0) {
        const dist = x - centerCol;
        dev = peakDevPx * Math.exp(-(dist * dist) / (2 * 10 * 10));
      }
      const y = baseY + dev;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Crosshair overlay
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Overlay text
    ctx.fillStyle = '#22c55e';
    ctx.font = '10px monospace';
    ctx.fillText('CAM: OV2640 [320x240 @ 28 FPS]', 8, 16);
    ctx.fillText('FILTER: Sub-Pixel Centroid', 8, 28);
  }, [latestDefect]);

  const handleRecalibrate = () => {
    setIsCalibrating(true);
    setCalibrationSuccess(false);
    setTimeout(() => {
      onCalibrate(scaleFactor);
      setIsCalibrating(false);
      setCalibrationSuccess(true);
      setTimeout(() => setCalibrationSuccess(false), 3000);
    }, 800);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-slate-100 text-sm">
            Laser-Line Profile & Sub-Pixel Triangulation
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
            Baseline: Calibrated (320 cols)
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-mono">
            θ = {laserAngle}°
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3">
        {/* Profile Deviation Plot */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> Calibrated Baseline (Flat Belt)
              <span className="w-2.5 h-0.5 bg-rose-500 inline-block ml-2" /> Extracted Laser Line
            </span>
            <span className="font-mono text-slate-300">
              Max Deviation: <strong className="text-amber-400">{latestDefect ? `${latestDefect.laserDeviationMm.toFixed(2)} mm` : '0.00 mm'}</strong>
            </span>
          </div>

          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
            <canvas ref={plotCanvasRef} width={580} height={200} className="w-full h-auto block" />
          </div>
        </div>

        {/* Camera Feed & Calibration Controls */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-indigo-400" /> ESP32-CAM Sensor Frame
              </span>
              <span className="text-emerald-400 font-mono">LIVE DMA</span>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 mb-3">
              <canvas ref={camFeedCanvasRef} width={280} height={130} className="w-full h-auto block" />
            </div>

            {/* Scale Calibration Controls */}
            <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-slate-400" /> Scale (mm/px):
                </span>
                <span className="font-mono font-bold text-slate-200">{scaleFactor.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.45"
                step="0.005"
                value={scaleFactor}
                onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5"
              />

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleRecalibrate}
                  disabled={isCalibrating}
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin' : ''}`} />
                  {isCalibrating ? 'Zeroing Baseline...' : 'Re-Zero Baseline'}
                </button>
              </div>

              {calibrationSuccess && (
                <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1">
                  <CheckCircle2 className="w-3 h-3" /> Baseline re-calibrated successfully!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
