import React from 'react';
import { Cpu, Zap, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const HardwareWiringDiagram: React.FC = () => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-slate-100 text-sm">
            ESP32-CAM AI-Thinker Pinout & Electrical Isolation Schematic
          </h3>
        </div>

        <span className="text-xs px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> High Current & Voltage Warnings Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Schematic Card 1: ESP32-CAM Pin Allocation */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-slate-200">ESP32-CAM Pin Assignments</span>
            <span className="text-[10px] font-mono text-indigo-400">AI-Thinker</span>
          </div>

          <div className="text-xs space-y-1.5 font-mono">
            <div className="flex justify-between p-1 bg-slate-900 rounded border border-slate-800">
              <span className="text-sky-400 font-bold">GPIO 12 (HS2_DATA2)</span>
              <span className="text-slate-300">Proximity Opto In</span>
            </div>
            <div className="flex justify-between p-1 bg-slate-900 rounded border border-slate-800">
              <span className="text-amber-400 font-bold">GPIO 13 (HS2_DATA3)</span>
              <span className="text-slate-300">SG90 Servo PWM</span>
            </div>
            <div className="flex justify-between p-1 bg-slate-900 rounded border border-slate-800">
              <span className="text-rose-400 font-bold">GPIO 14 (HS2_CLK)</span>
              <span className="text-slate-300">Laser MOSFET Gate</span>
            </div>
            <div className="flex justify-between p-1 bg-slate-900 rounded border border-slate-800">
              <span className="text-indigo-400 font-bold">GPIO 15 (HS2_CMD)</span>
              <span className="text-slate-300">Calibrate Button</span>
            </div>
            <div className="flex justify-between p-1 bg-slate-900 rounded border border-slate-800">
              <span className="text-emerald-400 font-bold">GPIO 33 (LED)</span>
              <span className="text-slate-300">Heartbeat Blink</span>
            </div>
            <div className="flex justify-between p-1 bg-slate-900/50 rounded border border-slate-800 text-slate-500">
              <span>GPIO 4 (Flash)</span>
              <span>Disabled (Optics)</span>
            </div>
          </div>
        </div>

        {/* Schematic Card 2: PC817 Optocoupler Isolation */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-slate-200">12V/24V Proximity Isolation</span>
            <span className="text-[10px] font-mono text-emerald-400">PC817 Opto</span>
          </div>

          <div className="text-[11px] text-slate-300 space-y-2 font-mono">
            <div className="bg-slate-900 p-2 rounded border border-slate-800 text-[10px] leading-relaxed">
              <p className="text-amber-400 font-bold">⚠️ NEVER CONNECT 12V TO GPIO!</p>
              <p className="text-slate-400 mt-1">
                +12V DC ──► Sensor VCC<br />
                GND ─────► Sensor GND<br />
                NPN Out ─► PC817 Anode (via 2.2kΩ)<br />
                PC817 Cathode ─► GND<br />
                <br />
                <span className="text-sky-300">Isolated 3.3V Side:</span><br />
                PC817 Collector ─► GPIO 12 (1kΩ to 3.3V)<br />
                PC817 Emitter ──► ESP32 GND
              </p>
            </div>
            <p className="text-[10px] text-slate-400">
              Completely prevents 12V industrial transients from destroying the ESP32 input stage.
            </p>
          </div>
        </div>

        {/* Schematic Card 3: Dedicated SG90 5V Power */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-slate-200">SG90 Servo Power Circuit</span>
            <span className="text-[10px] font-mono text-amber-400">5V 2A Buck</span>
          </div>

          <div className="text-[11px] text-slate-300 space-y-2 font-mono">
            <div className="bg-slate-900 p-2 rounded border border-slate-800 text-[10px] leading-relaxed">
              <p className="text-amber-400 font-bold">⚠️ BROWNOUT PREVENTION</p>
              <p className="text-slate-400 mt-1">
                External 5V 2A ──► Servo VCC (Red)<br />
                Common GND ──────► Servo GND (Brown)<br />
                ESP32 GPIO 13 ──► Servo PWM (Orange)<br />
                <br />
                <span className="text-emerald-300">Grounding Rule:</span><br />
                Tie External 5V GND to ESP32 GND rail to maintain common PWM signal reference.
              </p>
            </div>
            <p className="text-[10px] text-slate-400">
              SG90 stall current (up to 800mA) is isolated from ESP32 3.3V LDO regulator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
