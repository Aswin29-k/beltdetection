import React, { useState } from 'react';
import { Terminal, Send, CheckCircle, AlertCircle, Play } from 'lucide-react';

interface EndpointOption {
  name: string;
  method: 'GET' | 'POST';
  url: string;
  body?: string;
  description: string;
}

const ENDPOINTS: EndpointOption[] = [
  {
    name: 'System Health Check',
    method: 'GET',
    url: '/health',
    description: 'Verify backend uptime and controller responsiveness'
  },
  {
    name: 'System Telemetry Status',
    method: 'GET',
    url: '/api/system-status',
    description: 'Query comprehensive hardware metrics, defect counts, and sensor health'
  },
  {
    name: 'Conveyor Telemetry',
    method: 'GET',
    url: '/api/telemetry',
    description: 'Fetch current belt velocity, RPM, rev counter, and optics calibration'
  },
  {
    name: 'Recent Defect Logs',
    method: 'GET',
    url: '/api/defects?limit=5',
    description: 'Retrieve logged defect records sorted by timestamp'
  },
  {
    name: 'Joint Synchronization Status',
    method: 'GET',
    url: '/api/joint-status',
    description: 'Get proximity revolution period, rotational phase angle, and splice margin'
  },
  {
    name: 'Predictive Maintenance Report',
    method: 'GET',
    url: '/api/predictive-maintenance',
    description: 'Calculate degradation slope, estimated hours remaining, and RUL confidence'
  },
  {
    name: 'Manual Dry-Run Servo Test',
    method: 'POST',
    url: '/api/marking/trigger-test',
    body: JSON.stringify({ angle: 65, pulseMs: 300 }, null, 2),
    description: 'Trigger SG90 actuation pulse without spray paint discharge'
  },
  {
    name: 'Arm Marking Servo',
    method: 'POST',
    url: '/api/marking/enable',
    description: 'Enable automated defect marking'
  },
  {
    name: 'Emergency Disarm Servo',
    method: 'POST',
    url: '/api/marking/disable',
    description: 'Activate emergency safety lockout on marking actuator'
  },
  {
    name: 'Gemini AI Diagnostic Scan',
    method: 'POST',
    url: '/api/ai/analyze',
    body: JSON.stringify({ contextNotes: 'Shift inspection report via API test bench' }, null, 2),
    description: 'Invoke Gemini 3.8 Flash for structured conveyor reliability assessment'
  }
];

export const ApiTestBench: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointOption>(ENDPOINTS[0]);
  const [requestBody, setRequestBody] = useState<string>(selectedEndpoint.body || '');
  const [responseOutput, setResponseOutput] = useState<string>('// Response payload will appear here');
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = (ep: EndpointOption) => {
    setSelectedEndpoint(ep);
    setRequestBody(ep.body || '');
    setResponseOutput('// Ready to send request');
    setStatusCode(null);
    setLatencyMs(null);
  };

  const handleExecute = async () => {
    setIsLoading(true);
    const start = performance.now();
    try {
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: { 'Content-Type': 'application/json' }
      };
      if (selectedEndpoint.method === 'POST' && requestBody) {
        options.body = requestBody;
      }

      const res = await fetch(selectedEndpoint.url, options);
      const data = await res.json();
      const end = performance.now();

      setStatusCode(res.status);
      setLatencyMs(Math.round(end - start));
      setResponseOutput(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setStatusCode(500);
      setResponseOutput(JSON.stringify({ error: err.message || 'Network request failed' }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-slate-100 text-sm">
            REST API Test Bench & Hardware Telemetry Explorer
          </h3>
        </div>

        {statusCode !== null && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`px-2 py-0.5 rounded font-bold ${
              statusCode >= 200 && statusCode < 300
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}>
              HTTP {statusCode}
            </span>
            <span className="text-slate-400">{latencyMs} ms</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
        {/* Endpoint Selector */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Available API Routes
          </span>
          {ENDPOINTS.map((ep) => (
            <button
              key={ep.name}
              onClick={() => handleSelect(ep)}
              className={`w-full text-left p-2 rounded text-xs transition flex items-center justify-between ${
                selectedEndpoint.name === ep.name
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <span className="truncate">{ep.name}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                ep.method === 'GET' ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {ep.method}
              </span>
            </button>
          ))}
        </div>

        {/* Request & Response Panels */}
        <div className="md:col-span-2 space-y-3">
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                selectedEndpoint.method === 'GET' ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {selectedEndpoint.method}
              </span>
              <span className="text-slate-200">{selectedEndpoint.url}</span>
            </div>

            <button
              onClick={handleExecute}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-semibold shadow transition"
            >
              <Send className="w-3.5 h-3.5" />
              {isLoading ? 'Executing...' : 'Send Request'}
            </button>
          </div>

          {selectedEndpoint.method === 'POST' && (
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                JSON Request Body:
              </span>
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">
              JSON Response Body:
            </span>
            <pre className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs font-mono text-emerald-400/90 overflow-x-auto max-h-56 leading-relaxed">
              {responseOutput}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
