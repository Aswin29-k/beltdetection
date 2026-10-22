import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle2, Clock, Gauge } from 'lucide-react';
import { PredictiveMaintenanceData } from '../types';

interface PredictiveRulChartProps {
  data: PredictiveMaintenanceData;
}

export const PredictiveRulChart: React.FC<PredictiveRulChartProps> = ({ data }) => {
  const trends = data.trends || [];
  const maxDev = data.currentMaxDeviationMm || 0;
  const criticalLimit = data.criticalThresholdMm || 8.0;
  const pctOfCritical = Math.min(100, (maxDev / criticalLimit) * 100);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-slate-100 text-sm">
            Predictive Maintenance & Remaining Useful Life (RUL)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {data.dataSufficient ? (
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sufficient Trend Samples ({data.sampleCount} revs)
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Trend Data Accumulating ({data.sampleCount} revs)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        {/* Metric 1: Degradation Rate */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Joint Degradation Rate</span>
          <p className="text-xl font-mono font-bold text-slate-100">
            {data.degradationRateMmPerRev.toFixed(3)}{' '}
            <span className="text-xs font-normal text-slate-400">mm/rev</span>
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Linear slope across verified splice passes
          </span>
        </div>

        {/* Metric 2: Estimated Revolutions Left */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Revolutions Remaining</span>
          <p className="text-xl font-mono font-bold text-amber-400">
            {data.estimatedRevolutionsRemaining}{' '}
            <span className="text-xs font-normal text-slate-400">revs</span>
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Before reaching {criticalLimit.toFixed(1)}mm critical threshold
          </span>
        </div>

        {/* Metric 3: Estimated Hours Left */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Remaining Operating Life</span>
          <p className="text-xl font-mono font-bold text-sky-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-sky-400" />
            {data.estimatedHoursRemaining.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">hrs</span>
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            At current belt speed & shift utilization
          </span>
        </div>

        {/* Metric 4: Statistical Confidence */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Model Confidence</span>
          <p className="text-xl font-mono font-bold text-emerald-400 flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-emerald-400" />
            {Math.round(data.confidenceScore * 100)}%
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Variance score over sample distribution
          </span>
        </div>
      </div>

      {/* Degradation Trend Visual Bar */}
      <div className="mt-4 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
        <div className="flex justify-between text-xs text-slate-300 mb-1.5">
          <span>Splice Carcass Degradation Envelope:</span>
          <span className="font-mono">
            <strong>{maxDev.toFixed(2)} mm</strong> / {criticalLimit.toFixed(1)} mm ({pctOfCritical.toFixed(0)}%)
          </span>
        </div>

        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
          <div
            className={`h-full transition-all duration-500 ${
              pctOfCritical > 85 ? 'bg-rose-500' : pctOfCritical > 60 ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${pctOfCritical}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
          <span>0.0 mm (New Belt)</span>
          <span>4.0 mm (Warning)</span>
          <span>6.0 mm (High Wear)</span>
          <span>8.0 mm (Critical Splice Limit)</span>
        </div>

        {data.warningMessage && (
          <div className={`mt-3 p-2.5 rounded text-xs flex items-center gap-2 ${
            data.warningMessage.includes('CRITICAL')
              ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              : data.warningMessage.includes('INSUFFICIENT')
              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{data.warningMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
