import React, { useState } from 'react';
import { Bot, Sparkles, AlertTriangle, ShieldCheck, Wrench, CheckCircle2, RefreshCw } from 'lucide-react';
import { AIAnalysisReport, DefectItem, TelemetryData } from '../types';

interface GeminiDiagnosticsProps {
  telemetry: TelemetryData;
  defects: DefectItem[];
  onTriggerAnalysis: (notes: string) => Promise<AIAnalysisReport | null>;
}

export const GeminiDiagnostics: React.FC<GeminiDiagnosticsProps> = ({
  telemetry,
  defects,
  onTriggerAnalysis,
}) => {
  const [notes, setNotes] = useState('Post-shift inspection following high-load iron ore conveying.');
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<AIAnalysisReport | null>(null);
  const [source, setSource] = useState<string>('gemini-3.8-flash');

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await onTriggerAnalysis(notes);
      if (res) {
        setReport(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              Gemini AI Predictive Maintenance & Reliability Agent
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-mono">
                Model: gemini-3.8-flash
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Evaluates carcass tension, splice shear delamination, and compliance with DIN 22102 / ISO 15236
            </p>
          </div>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Synthesizing Diagnostics...' : 'Run Gemini Analysis'}
        </button>
      </div>

      {/* Operator Context Input */}
      <div className="mt-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 flex items-center gap-3">
        <span className="text-xs text-slate-400 shrink-0">Operator Context / Shift Notes:</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="E.g. High ambient humidity, sudden tension spike, abnormal belt vibration..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Report Cards View */}
      {report ? (
        <div className="mt-4 space-y-4">
          {/* Executive Summary & Risk Badge */}
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Executive Health Summary
              </span>
              <p className="text-sm text-slate-200 mt-1 leading-relaxed">
                {report.summary}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <span className="text-[10px] text-slate-400 block mb-1">Assessed Risk Category</span>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold font-mono ${
                report.riskCategory === 'CRITICAL_URGENT'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                  : report.riskCategory === 'HIGH'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
              }`}>
                {report.riskCategory}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Joint Condition Card */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> Vulcanized Joint Structural Evaluation
                </span>
                <span className="font-mono text-sky-400 font-bold">
                  {report.jointCondition?.spliceIntegrityRatingPercent}% Integrity
                </span>
              </div>

              <div className="mt-2.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Splice Status:</span>
                  <span className="font-mono font-bold text-slate-200">{report.jointCondition?.status}</span>
                </div>
                <p className="text-slate-300 text-[11px] bg-slate-900/60 p-2 rounded border border-slate-800/60">
                  {report.jointCondition?.riskDescription}
                </p>
              </div>
            </div>

            {/* Degradation Trend Card */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Degradation Trajectory & Prognosis
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  RUL: {report.degradationTrend?.estimatedRulHours}
                </span>
              </div>

              <div className="mt-2.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Pattern:</span>
                  <span className="font-mono text-slate-200">{report.degradationTrend?.pattern}</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {report.degradationTrend?.confidenceAssessment}
                </p>
              </div>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2.5">
              <Wrench className="w-3.5 h-3.5 text-emerald-400" /> Recommended Maintenance & Inspection Actions
            </h4>

            <div className="space-y-2">
              {report.recommendedActions?.map((act, i) => (
                <div
                  key={i}
                  className="bg-slate-900 p-2.5 rounded border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                      act.priority.includes('1') || act.priority.includes('IMMEDIATE')
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    }`}>
                      {act.priority}
                    </span>
                    <span className="text-slate-200">{act.action}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0">
                    {act.timeframe}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-slate-500 mt-2 italic">
              Note: {report.dataQualityNotes}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 p-8 bg-slate-950/60 rounded-lg border border-dashed border-slate-800 text-center">
          <Bot className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">
            Click <strong>"Run Gemini Analysis"</strong> to execute an AI diagnostic synthesis of laser profiles, joint wear, and RUL trends.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Local real-time physical defect marking is autonomous and runs uninterrupted.
          </p>
        </div>
      )}
    </div>
  );
};
