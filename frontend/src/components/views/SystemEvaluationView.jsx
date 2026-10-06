import React, { useEffect, useState } from 'react';
import {
  BarChart2, ShieldCheck, Zap, RotateCcw, CheckCircle2, Loader2, AlertCircle, Info, Play
} from 'lucide-react';
import { fetchBenchmarkResults, fetchDynamicScenarios, injectDynamicScenario } from '../../services/api';

const NUM = (v, digits = 1, suffix = '') =>
  typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(digits)}${suffix}` : 'not measured';

/**
 * Evaluation screen.
 *
 * Every number comes from GET /api/evaluation/benchmark, which measures each policy by
 * running it in a fresh seeded simulation. The screen deliberately does NOT compute
 * "improvement percentages" of its own: the benchmark's own explanation list is rendered
 * instead, because on the published seeds the grid-safe policy trades a longer wait for zero
 * transformer overloads, and the two policies do not dominate each other.
 */
export default function SystemEvaluationView() {
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seed, setSeed] = useState(42);

  // Scenario runner (same screen, real /api/scenarios endpoints)
  const [scenarios, setScenarios] = useState([]);
  const [scenarioId, setScenarioId] = useState('');
  const [scenarioResult, setScenarioResult] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState(null);

  const loadBenchmark = async (useSeed = seed) => {
    setLoading(true);
    setError(null);
    try {
      setBenchmarkData(await fetchBenchmarkResults(useSeed));
    } catch (err) {
      setError(err.message || 'Failed to execute the comparative benchmark.');
      setBenchmarkData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBenchmark(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    fetchDynamicScenarios()
      .then((list) => {
        const items = Array.isArray(list) ? list : [];
        setScenarios(items);
        if (items.length > 0) setScenarioId(items[0].id);
      })
      .catch((err) => setScenarioError(err.message || 'Scenario list unavailable.'));
  }, []);

  const runScenario = async () => {
    if (!scenarioId) return;
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      setScenarioResult(await injectDynamicScenario(scenarioId, seed));
    } catch (err) {
      setScenarioError(err.message || 'Scenario execution failed.');
      setScenarioResult(null);
    } finally {
      setScenarioLoading(false);
    }
  };

  const strategies = benchmarkData?.strategies || [];
  const proposed = strategies.find((s) => s.strategy_id === 'INTELLIGENT_AI_PROPOSED') || null;
  const baselines = strategies.filter((s) => s.strategy_id !== 'INTELLIGENT_AI_PROPOSED');
  const baselineOverloads = baselines.reduce((acc, s) => acc + (s.grid_overload_incidents || 0), 0);
  const before = scenarioResult?.before_metrics;
  const after = scenarioResult?.after_metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="ai-card p-5 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge-blue">EVALUATION</span>
              <span className="text-xs text-slate-500 font-mono">MEASURED FROM SEEDED SIMULATIONS</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Scheduling Policy Comparison</h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Four scheduling policies are executed one after another in an identical seeded simulation.
              The table reports what was measured; it is not a claim about the AI pipeline, which is
              demonstrated on its own screens (search, CSP, logic, conflict resolution).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Seed:</span>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value, 10) || 42)}
                className="form-input text-xs w-20 py-1"
              />
            </div>
            <button onClick={() => loadBenchmark(seed)} disabled={loading} className="btn-primary text-xs flex items-center gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              <span>Re-run</span>
            </button>
          </div>
        </div>
        {benchmarkData?.simulation_disclaimer && (
          <p className="mt-3 text-[11px] text-slate-500 flex items-start gap-1.5 border-t border-slate-100 pt-3">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
            <span>{benchmarkData.simulation_disclaimer}</span>
          </p>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </span>
          <button onClick={() => loadBenchmark(seed)} className="btn-secondary text-xs px-2.5 py-1 shrink-0">Retry</button>
        </div>
      )}

      {/* Measured headline numbers */}
      {proposed && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="ai-card p-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Grid-safe policy: overloads</span>
            <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono">{proposed.grid_overload_incidents}</div>
            <span className="text-[11px] text-slate-500 block mt-1">
              vs {baselineOverloads} recorded by the three baselines on this seed
            </span>
          </div>
          <div className="ai-card p-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Peak transformer draw</span>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">{NUM(proposed.peak_grid_load_kw, 0, ' kW')}</div>
            <span className="text-[11px] text-slate-500 block mt-1">rating is 450 kW in this environment</span>
          </div>
          <div className="ai-card p-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Average wait</span>
            <div className="mt-2 text-2xl font-bold text-blue-700 font-mono">{NUM(proposed.avg_wait_time_min, 1, ' min')}</div>
            <span className="text-[11px] text-slate-500 block mt-1">
              higher than FCFS by design: sessions are deferred instead of overloading the transformer
            </span>
          </div>
          <div className="ai-card p-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Completed</span>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
              {proposed.completed_evs}/{proposed.total_evs}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              allocation {NUM(proposed.successful_allocation_pct, 1, '%')} · unit price ${NUM(proposed.unit_price_usd_per_kwh, 3)}
            </span>
          </div>
        </div>
      )}

      {/* Strategy table */}
      <div className="ai-card p-5 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Strategy comparison matrix</h3>
          <p className="text-xs text-slate-500">
            {benchmarkData
              ? `Seed ${benchmarkData.seed} · ${benchmarkData.simulation_ticks} simulated minutes · ${strategies.length} policies measured`
              : 'Awaiting benchmark run'}
          </p>
        </div>

        <div className="ai-table-container">
          <table className="ai-table">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Class</th>
                <th className="text-right">Avg wait</th>
                <th className="text-right">Avg travel</th>
                <th className="text-right">Avg cost</th>
                <th className="text-right">Utilisation</th>
                <th className="text-right">Overloads</th>
                <th className="text-right">Peak kW</th>
                <th className="text-right">Energy kWh</th>
                <th className="text-center">Completed</th>
              </tr>
            </thead>
            <tbody>
              {strategies.length > 0 ? (
                strategies.map((st) => {
                  const isProposed = st.strategy_id === 'INTELLIGENT_AI_PROPOSED';
                  return (
                    <tr key={st.strategy_id} className={isProposed ? 'bg-blue-50/50 font-semibold' : ''}>
                      <td className="text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{st.strategy_name}</span>
                          {isProposed && <span className="badge-blue text-[9px]">GRID-SAFE</span>}
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal max-w-md">{st.description}</div>
                      </td>
                      <td className="text-[10px] text-slate-600 font-mono">{st.policy_classification}</td>
                      <td className="text-right font-mono">{NUM(st.avg_wait_time_min, 1)}</td>
                      <td className="text-right font-mono">
                        {st.avg_travel_dist_km === null || st.avg_travel_dist_km === undefined
                          ? 'n/a'
                          : st.avg_travel_dist_km.toFixed(2)}
                      </td>
                      <td className="text-right font-mono">${NUM(st.avg_charging_cost_usd, 2)}</td>
                      <td className="text-right font-mono">{NUM(st.station_utilization_pct, 1)}%</td>
                      <td className={`text-right font-mono ${st.grid_overload_incidents === 0 ? 'text-emerald-700 font-bold' : 'text-rose-700'}`}>
                        {st.grid_overload_incidents}
                      </td>
                      <td className="text-right font-mono">{NUM(st.peak_grid_load_kw, 0)}</td>
                      <td className="text-right font-mono">{NUM(st.total_energy_delivered_kwh, 1)}</td>
                      <td className="text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          st.successful_allocation_pct >= 90 ? 'badge-emerald' : 'badge-rose'
                        }`}>
                          {st.completed_evs}/{st.total_evs} ({NUM(st.successful_allocation_pct, 0)}%)
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="text-center py-8 text-slate-500">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Running the four policies on a fresh seeded environment…</span>
                      </span>
                    ) : (
                      <span>No benchmark data. Press “Re-run” to execute the comparison.</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* The benchmark's own measured take-aways */}
        {(benchmarkData?.ai_decision_explanations || []).length > 0 && (
          <div className="border-t border-slate-200 pt-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              What the measurements show
            </h4>
            <ul className="space-y-2">
              {benchmarkData.ai_decision_explanations.map((entry) => (
                <li key={entry.topic} className="text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">{entry.topic}: </span>
                  <span>{entry.explanation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {benchmarkData && (
          <p className="text-[11px] text-slate-500 flex items-start gap-1.5 border-t border-slate-100 pt-3">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
            <span>
              Provenance: {benchmarkData.strategies[0]?.data_provenance || 'MEASURED_FROM_SEEDED_SIMULATION'}.
              Deterministic for a fixed seed, so re-running with the same seed reproduces the table.
            </span>
          </p>
        )}
      </div>

      {/* Dynamic scenarios: real /api/scenarios endpoints */}
      <div className="ai-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              Dynamic scenario run
            </h3>
            <p className="text-xs text-slate-500">
              Injects one event into a fresh seeded simulation and reports the measured before/after state.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              className="form-input text-xs py-1 max-w-xs"
              disabled={scenarios.length === 0}
            >
              {scenarios.length === 0 && <option value="">No scenarios available</option>}
              {scenarios.map((sc) => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
            <button
              onClick={runScenario}
              disabled={scenarioLoading || !scenarioId}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              {scenarioLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Run</span>
            </button>
          </div>
        </div>

        {scenarioError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800">{scenarioError}</div>
        )}

        {scenarios.length === 0 && !scenarioError && (
          <p className="text-xs text-slate-500">Loading scenario catalogue…</p>
        )}

        {scenarioResult && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="badge-emerald flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {scenarioResult.event_injected}
              </span>
              <span className="text-slate-400 font-mono">
                scenario {scenarioResult.scenario_id} · seed {scenarioResult.seed} · {scenarioResult.execution_time_ms} ms
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{scenarioResult.explanation_summary}</p>

            {before && after && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
                {[
                  ['Grid load kW', before.grid_load_kw, after.grid_load_kw],
                  ['Queue length', before.total_queue_length, after.total_queue_length],
                  ['Avg wait min', before.average_wait_min, after.average_wait_min],
                  ['Utilisation %', before.station_utilization_pct, after.station_utilization_pct],
                  ['Operational st.', before.operational_stations_count, after.operational_stations_count],
                  ['Solar kW (modelled)', before.renewable_power_kw, after.renewable_power_kw],
                ].map(([label, b, a]) => (
                  <div key={label} className="bg-slate-50 border border-slate-200 rounded-md py-2 px-1">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="text-xs font-mono text-slate-500">{b}</div>
                    <div className="text-sm font-bold font-mono text-slate-900">→ {a}</div>
                  </div>
                ))}
              </div>
            )}

            {scenarioResult.ai_layer_trace?.length > 0 && (
              <div className="space-y-2">
                {scenarioResult.ai_layer_trace.map((t) => (
                  <div key={t.step} className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase text-blue-700">
                        Step {t.step} · {t.layer}
                      </span>
                      <span className="font-semibold text-slate-900">{t.action}</span>
                    </div>
                    <p className="text-slate-600 pt-1">{t.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
