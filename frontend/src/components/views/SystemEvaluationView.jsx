import React, { useEffect, useState } from 'react';
import {
  BarChart2, ShieldCheck, Zap, RotateCcw, CheckCircle2, Loader2, AlertCircle, Info, Play
} from 'lucide-react';
import { fetchBenchmarkResults, fetchDynamicScenarios, injectDynamicScenario } from '../../services/api';
import { PageHeader, StatTile, Banner } from '../common';

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
    <div className="page">
      <PageHeader
        eyebrow="Evaluation"
        title="Scheduling policy comparison"
        description="Four scheduling policies run one after another inside an identical seeded simulation. Everything in the table is measured from those runs, not estimated. The AI decision pipeline itself is demonstrated on its own screens (search, CSP, logic, conflict resolution)."
        actions={
          <div className="toolbar">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Seed
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value, 10) || 42)}
                className="form-input w-24"
                aria-label="Random seed"
              />
            </label>
            <button
              type="button"
              onClick={() => loadBenchmark(seed)}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {loading ? 'Running…' : 'Re-run benchmark'}
            </button>
          </div>
        }
      />

      {benchmarkData?.simulation_disclaimer && (
        <Banner variant="info">
          {benchmarkData.simulation_disclaimer}
        </Banner>
      )}

      {error && (
        <Banner
          variant="error"
          action={
            <button
              type="button"
              onClick={() => loadBenchmark(seed)}
              className="btn-secondary btn-sm"
            >
              Retry
            </button>
          }
        >
          <strong>Benchmark failed.</strong> {error}
        </Banner>
      )}

      {/* Measured headline numbers */}
      {proposed && (
        <div className="stat-grid">
          <StatTile
            label="Grid overloads (this policy)"
            value={proposed.grid_overload_incidents}
            tone={proposed.grid_overload_incidents === 0 ? 'success' : 'danger'}
            hint={`Baselines recorded ${baselineOverloads} on the same seed`}
          />
          <StatTile
            label="Peak transformer draw"
            value={NUM(proposed.peak_grid_load_kw, 0, '')}
            unit="kW"
            hint="Transformer rating is 450 kW in this environment"
          />
          <StatTile
            label="Average wait"
            value={NUM(proposed.avg_wait_time_min, 1, '')}
            unit="min"
            tone="primary"
            hint="Higher than FCFS by design: sessions are deferred rather than overloading the grid"
          />
          <StatTile
            label="Completed"
            value={`${proposed.completed_evs}/${proposed.total_evs}`}
            hint={`Allocation ${NUM(proposed.successful_allocation_pct, 1, '%')} · unit price $${NUM(proposed.unit_price_usd_per_kwh, 3)}`}
          />
        </div>
      )}

      {/* Strategy table */}
      <div className="ai-card section space-y-4">
        <div className="section-head">
          <div>
            <h3 className="section-title">Strategy comparison matrix</h3>
            <p className="section-desc">
            {benchmarkData
              ? `Seed ${benchmarkData.seed} · ${benchmarkData.simulation_ticks} simulated minutes · ${strategies.length} policies measured`
              : 'Awaiting benchmark run'}
            </p>
          </div>
        </div>

        <div className="ai-table-container">
          <table className="ai-table">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Class</th>
                <th className="num">Avg wait</th>
                <th className="num">Avg travel</th>
                <th className="num">Avg cost</th>
                <th className="num">Utilisation</th>
                <th className="num">Overloads</th>
                <th className="num">Peak kW</th>
                <th className="num">Energy kWh</th>
                <th className="col-center">Completed</th>
              </tr>
            </thead>
            <tbody>
              {strategies.length > 0 ? (
                strategies.map((st) => {
                  const isProposed = st.strategy_id === 'INTELLIGENT_AI_PROPOSED';
                  return (
                    <tr key={st.strategy_id} className={isProposed ? 'row-selected font-semibold' : ''}>
                      <td className="text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{st.strategy_name}</span>
                          {isProposed && <span className="badge-blue text-2xs">GRID-SAFE</span>}
                        </div>
                        <div className="text-2xs text-slate-500 font-normal max-w-md">{st.description}</div>
                      </td>
                      <td className="text-2xs text-slate-600 font-mono">{st.policy_classification}</td>
                      <td className="num font-mono">{NUM(st.avg_wait_time_min, 1)}</td>
                      <td className="num font-mono">
                        {st.avg_travel_dist_km === null || st.avg_travel_dist_km === undefined
                          ? 'n/a'
                          : st.avg_travel_dist_km.toFixed(2)}
                      </td>
                      <td className="num font-mono">${NUM(st.avg_charging_cost_usd, 2)}</td>
                      <td className="num font-mono">{NUM(st.station_utilization_pct, 1)}%</td>
                      <td className={`text-right font-mono ${st.grid_overload_incidents === 0 ? 'text-emerald-700 font-bold' : 'text-rose-700'}`}>
                        {st.grid_overload_incidents}
                      </td>
                      <td className="num font-mono">{NUM(st.peak_grid_load_kw, 0)}</td>
                      <td className="num font-mono">{NUM(st.total_energy_delivered_kwh, 1)}</td>
                      <td className="col-center">
                        <span className={`px-2 py-0.5 rounded text-2xs font-semibold ${
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
            <h4 className="field-label">
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
          <p className="text-2xs text-slate-500 flex items-start gap-1.5 border-t border-slate-100 pt-3">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
            <span>
              Provenance: {benchmarkData.strategies[0]?.data_provenance || 'MEASURED_FROM_SEEDED_SIMULATION'}.
              Deterministic for a fixed seed, so re-running with the same seed reproduces the table.
            </span>
          </p>
        )}
      </div>

      {/* Dynamic scenarios: real /api/scenarios endpoints */}
      <div className="ai-card section space-y-4">
        <div className="section-head">
          <div>
            <h3 className="section-title">
              <Zap className="h-4 w-4 text-slate-400" />
              Dynamic scenario run
            </h3>
            <p className="section-desc">
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
              <div className="ai-table-container">
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th>Measured quantity</th>
                      <th className="num">Before</th>
                      <th className="num">After</th>
                      <th className="num">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Grid load', before.grid_load_kw, after.grid_load_kw, 'kW'],
                      ['Queue length', before.total_queue_length, after.total_queue_length, ''],
                      ['Average wait', before.average_wait_min, after.average_wait_min, 'min'],
                      ['Station utilisation', before.station_utilization_pct, after.station_utilization_pct, '%'],
                      ['Operational stations', before.operational_stations_count, after.operational_stations_count, ''],
                      ['Renewable power (modelled)', before.renewable_power_kw, after.renewable_power_kw, 'kW']
                    ].map(([label, b, a, unit]) => {
                      const delta = Number(a) - Number(b);
                      return (
                        <tr key={label}>
                          <td className="font-medium text-slate-800">
                            {label}
                            {unit ? ` (${unit})` : ''}
                          </td>
                          <td className="num font-mono">{b}</td>
                          <td className="num font-mono font-semibold">{a}</td>
                          <td
                            className={`num font-mono ${
                              delta === 0
                                ? 'text-slate-500'
                                : delta > 0
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                            }`}
                          >
                            {delta > 0 ? '+' : ''}
                            {Number.isFinite(delta) ? delta.toFixed(2) : 'n/a'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {scenarioResult.ai_layer_trace?.length > 0 && (
              <div className="space-y-2">
                {scenarioResult.ai_layer_trace.map((t) => (
                  <div key={t.step} className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-2xs font-bold uppercase text-blue-700">
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
