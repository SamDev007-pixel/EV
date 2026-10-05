import React, { useState } from 'react';
import { injectDynamicScenario } from '../../services/api';
import {
  Zap,
  AlertTriangle,
  ShieldCheck,
  Play,
  CheckCircle2,
  RotateCcw,
  Activity,
  ArrowRight,
  Loader2,
  TrendingDown,
  TrendingUp
} from 'lucide-react';

export default function DynamicScenarioControlPanel() {
  const [selectedScenario, setSelectedScenario] = useState('PEAK_DEMAND_SURGE');
  const [seed, setSeed] = useState(42);
  const [scenarioResult, setScenarioResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const scenarios = [
    {
      id: 'PEAK_DEMAND_SURGE',
      name: 'Grid Peak Demand Surge',
      description: 'Simulates a sudden +120 kW power draw spike on the transformer, threatening overload.',
      type: 'GRID'
    },
    {
      id: 'ROAD_CONGESTION_SPIKE',
      name: 'Corridor Traffic Jam',
      description: 'Induces severe congestion (+8 min travel time delay) along primary waypoint routes.',
      type: 'ROAD'
    },
    {
      id: 'CHARGER_HARDWARE_FAULT',
      name: 'Hub Charger Hardware Failure',
      description: 'Forces Station CS-01 offline, requiring immediate dynamic rerouting of all queued vehicles.',
      type: 'HARDWARE'
    },
    {
      id: 'EMERGENCY_AMBULANCE_DISPATCH',
      name: '108 Priority Emergency EV',
      description: 'Dispatches emergency ambulance with <15% battery requiring instantaneous slot preemption.',
      type: 'PRIORITY'
    },
    {
      id: 'SOLAR_CLOUD_COVER_DROP',
      name: 'Solar Generation Cloud Drop',
      description: 'Solar microgrid output drops from 80 kW to 10 kW, triggering energy reallocation.',
      type: 'RENEWABLE'
    }
  ];

  const handleRunScenario = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await injectDynamicScenario(selectedScenario, parseInt(seed) || 42);
      setScenarioResult(res);
    } catch (err) {
      console.error('Failed to trigger scenario:', err);
      setError('Unable to trigger scenario. Verify the backend service is operational.');
    } finally {
      setLoading(false);
    }
  };

  const before = scenarioResult?.system_metrics_before;
  const after = scenarioResult?.system_metrics_after;
  const trace = scenarioResult?.ai_layer_trace || [];
  const affected = scenarioResult?.affected_ev_ids || [];
  const reallocated = scenarioResult?.reallocated_ev_ids || [];

  return (
    <div className="space-y-6 font-sans">
      {/* AI Academic Concept Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">
              UNIT I & UNIT II
            </span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Dynamic Environment Adaptation & Reactive Search
            </h3>
          </div>
          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Deterministic Seed Validation
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {['Nature of Environments (Dynamic)', 'Discrete-Event Simulation', 'Reactive Rule Preemption', 'A* Dynamic Rerouting', 'CSP Schedule Regeneration'].map((topic) => (
            <span key={topic} className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium">
              {topic}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-100">
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">1. WHAT IS THE AI CONCEPT?</span>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              Dynamic environment response: handling environmental uncertainty, hardware faults, and emergency triage through deterministic AI.
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">2. WHERE IS IT USED HERE?</span>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              Network Event Simulator: Injecting 5 urban anomalies (demand surges, station outages, solar drops) with seed determinism.
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">3. WHY IS IT USEFUL?</span>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              Validates that the AI pipeline reacts safely to unexpected real-world disturbances without crashing or causing blackouts.
            </p>
          </div>
        </div>
      </div>

      {/* Scenario Control Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Dynamic Network Scenario Injector
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Unit I / II Simulation
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Inject real-world operational anomalies to test autonomous multi-agent adaptation and CSP schedule recalculation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 uppercase text-[10px] font-semibold tracking-wider">Seed:</span>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="w-14 bg-white text-slate-900 font-bold px-1 py-0.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleRunScenario}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-white font-semibold text-xs bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Play className="w-4 h-4 fill-current text-white" />
              )}
              <span>Trigger Scenario</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* 5 Scenario Quick Select Cards */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Scenario to Trigger:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {scenarios.map((sc) => {
              const isSelected = selectedScenario === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc.id)}
                  className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-500 text-slate-900 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs mb-1 text-slate-900">{sc.name}</div>
                    <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{sc.description}</div>
                  </div>
                  {isSelected && (
                    <span className="mt-3 text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Active Target
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scenario Execution Result */}
      {scenarioResult && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Autonomous AI System Response
                </span>
                <span className="text-xs text-slate-400 font-mono">Seed {scenarioResult.seed}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {scenarioResult.event_injected}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                {scenarioResult.explanation_summary}
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-right min-w-[200px]">
              <span className="text-[11px] text-slate-500 block uppercase font-semibold">Response Latency</span>
              <span className="text-xl font-bold text-blue-600 font-mono">{scenarioResult.execution_time_ms} ms</span>
              <span className="text-xs text-slate-500 block mt-1">
                Affected: <strong>{affected.length}</strong> | Rerouted: <strong>{reallocated.length}</strong>
              </span>
            </div>
          </div>

          {/* Before vs After Impact Metrics */}
          {before && after && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Before vs After Adaptation Impact
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                {/* Grid Load */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                  <span className="text-[11px] text-slate-500 font-semibold block uppercase">Grid Load</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-slate-400">{before.grid_load_kw}kW</span>
                    <span className="text-slate-900 font-bold">{after.grid_load_kw} kW</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (after.grid_load_kw / 450.0) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Queue Size */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                  <span className="text-[11px] text-slate-500 font-semibold block uppercase">Queue Length</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-slate-400">{before.total_queue_length}</span>
                    <span className="text-slate-900 font-bold">{after.total_queue_length} cars</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (after.total_queue_length / 10.0) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Wait Time */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                  <span className="text-[11px] text-slate-500 font-semibold block uppercase">Avg Wait</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-slate-400">{before.average_wait_min}m</span>
                    <span className="text-slate-900 font-bold">{after.average_wait_min}m</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-slate-400 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (after.average_wait_min / 45.0) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Station Utilization */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                  <span className="text-[11px] text-slate-500 font-semibold block uppercase">Utilization</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-slate-400">{before.station_utilization_pct}%</span>
                    <span className="text-blue-600 font-bold">{after.station_utilization_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-600 h-full rounded-full transition-all"
                      style={{ width: `${after.station_utilization_pct}%` }}
                    />
                  </div>
                </div>

                {/* Active EVs */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                  <span className="text-[11px] text-slate-500 font-semibold block uppercase">Active EVs</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-slate-400">{before.active_ev_count}</span>
                    <span className="text-slate-900 font-bold">{after.active_ev_count}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block pt-0.5">Tracked Vehicles</span>
                </div>

                {/* Solar Output */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                  <span className="text-[11px] text-slate-500 font-semibold block uppercase">Solar Output</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-slate-400">{before.renewable_power_kw}kW</span>
                    <span className="text-emerald-700 font-bold">{after.renewable_power_kw} kW</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 block pt-0.5 font-medium">Clean Dispatch</span>
                </div>
              </div>
            </div>
          )}

          {/* Layered AI Mitigation Trace */}
          {trace.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Layered AI Mitigation Trace
              </h4>
              <div className="space-y-2">
                {trace.map((t) => (
                  <div key={t.step} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-mono font-bold uppercase">
                        Step {t.step}: {t.layer}
                      </span>
                      <span className="font-semibold text-slate-900">{t.action}</span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed pt-0.5">
                      {t.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
