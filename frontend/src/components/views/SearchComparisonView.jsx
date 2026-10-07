import React, { useState, useEffect, useCallback } from 'react';
import { compareSearchAlgorithms, recommendStation, fetchSearchNetwork } from '../../services/api';
import { PageHeader, Section, StatTile, StateBlock, Banner } from '../common';
import { Compass, Loader2, Info, Network } from 'lucide-react';

const ALGORITHM_TABS = ['ALL', 'A*', 'UCS', 'GBFS', 'BFS', 'DFS'];

function numberOf(value, digits = 2, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
  return `${Number(value).toFixed(digits)}${suffix}`;
}

export default function SearchComparisonView({ evs = [] }) {
  const [selectedEvId, setSelectedEvId] = useState('EV-07');
  const [batteryPct, setBatteryPct] = useState(15.0);
  const [deadlineMin, setDeadlineMin] = useState(90.0);
  const [batteryCapacity, setBatteryCapacity] = useState(60.0);
  const [targetBatteryPct, setTargetBatteryPct] = useState(80.0);

  const [networkGraph, setNetworkGraph] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL');

  const isSocInvalid = parseFloat(batteryPct) >= parseFloat(targetBatteryPct);
  const results = comparison?.comparison_matrix || [];
  const metrics = comparison?.metrics;
  const chosenAlgorithm = recommendation?.result?.algorithm || comparison?.algorithm;

  const loadPresetEV07 = () => {
    setSelectedEvId('EV-07');
    setBatteryPct(15.0);
    setDeadlineMin(90.0);
    setBatteryCapacity(60.0);
    setTargetBatteryPct(80.0);
    setError(null);
  };

  const runEvaluation = useCallback(async () => {
    if (isSocInvalid) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ev_id: selectedEvId,
        battery_percentage: parseFloat(batteryPct),
        battery_capacity_kwh: parseFloat(batteryCapacity),
        target_battery_percentage: parseFloat(targetBatteryPct),
        departure_deadline_min: parseFloat(deadlineMin),
        max_charging_rate_kw: 100.0,
        current_location: { x: 0.0, y: 0.0 },
        destination_location: { x: 10.0, y: 10.0 },
        charger_type_needed: 'DC_FAST'
      };

      const [graphData, algoData, recData] = await Promise.all([
        fetchSearchNetwork(),
        compareSearchAlgorithms(payload),
        recommendStation(payload)
      ]);

      setNetworkGraph(graphData);
      setComparison(algoData);
      setRecommendation(recData);
    } catch (err) {
      console.error('Failed to run the search evaluation', err);
      setComparison(null);
      setRecommendation(null);
      setError(err.message || 'The search benchmark could not be completed.');
    } finally {
      setLoading(false);
    }
  }, [selectedEvId, batteryPct, batteryCapacity, targetBatteryPct, deadlineMin, isSocInvalid]);

  useEffect(() => {
    runEvaluation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleResults =
    activeTab === 'ALL'
      ? results
      : results.filter((r) => String(r.algorithm).toUpperCase().includes(activeTab));

  return (
    <div className="page">

      <PageHeader
        eyebrow="Algorithm Benchmarks"
        title="Search Algorithm Performance Comparison"
        description="Compare BFS, DFS, Uniform Cost Search, Greedy Best-First, and A* search on the charging station network across path cost, nodes expanded, and execution time."
        actions={
          <>
            <button type="button" onClick={loadPresetEV07} className="btn-secondary">
              Load sample vehicle
            </button>
            <button
              type="button"
              onClick={runEvaluation}
              disabled={loading || isSocInvalid}
              className="btn-primary"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
              {loading ? 'Running…' : 'Run comparison'}
            </button>
          </>
        }
      />

      {/* Scenario inputs */}
      <Section
        title="Scenario parameters"
        description="The same scenario is passed to all five algorithms so their results are comparable."
      >
        <div className="form-grid">
          <div>
            <label className="form-label" htmlFor="search-ev">Vehicle</label>
            <select
              id="search-ev"
              value={selectedEvId}
              onChange={(e) => setSelectedEvId(e.target.value)}
              className="form-input"
            >
              <option value="EV-07">EV-07 (sample)</option>
              {evs.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.id} · {ev.priority}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="search-soc">Current SOC (%)</label>
            <input
              id="search-soc"
              type="number"
              min="5"
              max="95"
              value={batteryPct}
              onChange={(e) => setBatteryPct(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="search-target">Target SOC (%)</label>
            <input
              id="search-target"
              type="number"
              min="50"
              max="100"
              value={targetBatteryPct}
              onChange={(e) => setTargetBatteryPct(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="search-capacity">Battery capacity (kWh)</label>
            <input
              id="search-capacity"
              type="number"
              min="20"
              max="120"
              value={batteryCapacity}
              onChange={(e) => setBatteryCapacity(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="search-deadline">Deadline (min)</label>
            <input
              id="search-deadline"
              type="number"
              min="20"
              max="300"
              value={deadlineMin}
              onChange={(e) => setDeadlineMin(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={runEvaluation}
              disabled={loading || isSocInvalid}
              className="btn-secondary w-full"
            >
              Apply and re-run
            </button>
          </div>
        </div>

        {isSocInvalid && (
          <Banner variant="error">
            <strong>Invalid scenario.</strong> Target SOC ({targetBatteryPct}%) must be greater than
            the current SOC ({batteryPct}%).
          </Banner>
        )}
      </Section>

      {error && (
        <Banner
          variant="error"
          action={
            <button type="button" onClick={runEvaluation} className="btn-secondary btn-sm">
              Retry
            </button>
          }
        >
          <strong>Search benchmark failed.</strong> {error}
        </Banner>
      )}

      {/* Network summary - real counts from the graph the algorithms traverse */}
      <Section
        title="Search graph"
        description="The graph the algorithms traverse, built from the current station snapshot."
      >
        {networkGraph ? (
          <div className="stat-grid">
            <StatTile
              label="Nodes"
              value={networkGraph.nodes?.length ?? 0}
              hint={`${(networkGraph.nodes || []).filter((n) => n.node_type === 'CHARGING_STATION').length} charging stations and ${(networkGraph.nodes || []).filter((n) => n.node_type === 'WAYPOINT').length} junctions`}
            />
            <StatTile
              label="Edges"
              value={networkGraph.edges?.length ?? 0}
              hint="Directed road segments with distance, time and cost"
            />
            <StatTile
              label="Vehicle"
              value={selectedEvId}
              size="sm"
              hint={`SOC ${batteryPct}% → ${targetBatteryPct}%, deadline ${deadlineMin} min`}
            />
            <StatTile
              label="Search algorithms run"
              value={metrics?.algorithms_evaluated ?? results.length}
              tone="primary"
              hint="All run on this exact graph state"
            />
          </div>
        ) : (
          <StateBlock
            variant={loading ? 'loading' : 'empty'}
            title={loading ? 'Loading the search graph' : 'Graph unavailable'}
          />
        )}
      </Section>

      {/* Comparison table */}
      <Section
        title="Algorithm comparison matrix"
        description="Path cost is the composite step cost of the returned route; nodes expanded counts every state the algorithm took off the frontier."
        actions={
          <div className="tabs" role="tablist" aria-label="Filter algorithms">
            {ALGORITHM_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className="tab"
              >
                {tab === 'ALL' ? 'All' : tab}
              </button>
            ))}
          </div>
        }
      >
        {loading && results.length === 0 ? (
          <StateBlock
            variant="loading"
            title="Benchmarking the algorithms"
            detail="Each algorithm is searched independently over the same graph."
          />
        ) : visibleResults.length === 0 ? (
          <StateBlock
            variant="empty"
            title="No result for this filter"
            detail="Run the comparison again or choose a different algorithm."
          />
        ) : (
          <div className="ai-table-container">
            <table className="ai-table">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Algorithm</th>
                  <th className="whitespace-nowrap">Class</th>
                  <th className="num">Path cost</th>
                  <th className="num">Nodes expanded</th>
                  <th className="num">Runtime</th>
                  <th className="num">Duration</th>
                  <th className="num">Charging cost</th>
                  <th className="whitespace-nowrap">Station reached</th>
                  <th>Route</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.map((res) => {
                  const isChosen = res.algorithm === chosenAlgorithm;
                  const informed = ['A*', 'Greedy'].some((k) => String(res.algorithm).includes(k));
                  return (
                    <tr key={res.algorithm} className={isChosen ? 'row-selected' : ''}>
                      <td className="font-semibold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <span>{res.algorithm}</span>
                          {isChosen && <span className="badge-blue shrink-0">Selected</span>}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={informed ? 'badge-teal' : 'badge-slate'}>
                          {informed ? 'Informed' : 'Uninformed'}
                        </span>
                      </td>
                      <td className="num">{res.success ? numberOf(res.path_cost, 4) : 'n/a'}</td>
                      <td className="num">{numberOf(res.nodes_explored, 0)}</td>
                      <td className="num">{numberOf(res.execution_time_ms, 2, ' ms')}</td>
                      <td className="num">{numberOf(res.total_duration_min, 1, ' min')}</td>
                      <td className="num">
                        {res.total_charging_cost_usd === undefined
                          ? 'n/a'
                          : `$${numberOf(res.total_charging_cost_usd, 2)}`}
                      </td>
                      <td className="whitespace-nowrap">
                        {res.success ? (
                          <span className="badge-emerald shrink-0">{res.selected_station || 'reached'}</span>
                        ) : (
                          <span className="badge-rose shrink-0">No goal found</span>
                        )}
                      </td>
                      <td
                        className="col-code max-w-[22rem] truncate"
                        title={(res.path_names || []).join(' → ')}
                      >
                        {(res.path_names || []).join(' → ') || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {comparison?.explanation && (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-600">
            <Info className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
            {comparison.explanation}
          </p>
        )}
      </Section>

      {/* Measured comparison of the informed search */}
      {metrics && (
        <Section
          title="What the measurements show"
          description="These values are computed from the run above; no result is assumed in advance."
        >
          <div className="stat-grid">
            <StatTile
              label="Optimal path cost"
              value={numberOf(metrics.optimal_path_cost, 4)}
              tone="success"
              hint="Cost of the optimal route found in this run"
            />
            <StatTile
              label="A* matches optimum"
              value={metrics.astar_matches_ucs_optimum ? 'Yes' : 'No'}
              tone={metrics.astar_matches_ucs_optimum ? 'success' : 'warning'}
              hint="Whether A* returned the same cost as uniform cost search"
            />
            <StatTile
              label="Nodes: UCS vs A*"
              value={`${metrics.ucs_nodes_explored ?? 'n/a'} / ${metrics.astar_nodes_explored ?? 'n/a'}`}
              hint="Uniform cost search expanded this many, A* expanded the second count"
            />
            <StatTile
              label="A* node saving"
              value={numberOf(metrics.astar_node_saving_pct, 1, '%')}
              tone="primary"
              hint="Reduction in expanded nodes relative to uniform cost search"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              [
                'Heuristic',
                'A* and greedy best-first order the frontier using a straight-line distance estimate that never exceeds the true remaining distance.'
              ],
              [
                'Optimality',
                'A* and uniform cost search are admissible-cost algorithms; the table above shows whether they agreed on this run.'
              ],
              [
                'Greedy search',
                'Greedy best-first ignores the accumulated cost and can therefore commit to a locally closer but more expensive route.'
              ]
            ].map(([title, text]) => (
              <div key={title} className="rounded-md border border-slate-200 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Network className="h-3.5 w-3.5 text-blue-600" />
                  {title}
                </p>
                <p className="mt-1 text-2xs leading-relaxed text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Recommended plan from /search/solve */}
      {recommendation?.result && (
        <Section
          title="Recommended plan"
          description="The route and schedule the station-selection endpoint returned for these parameters."
        >
          <div className="stat-grid">
            <StatTile label="Algorithm used" value={recommendation.result.algorithm} size="sm" />
            <StatTile
              label="Selected station"
              value={recommendation.result.selected_station || 'n/a'}
              size="sm"
              tone="primary"
            />
            <StatTile
              label="Total duration"
              value={numberOf(recommendation.result.total_duration_min, 1, '')}
              unit="min"
              size="sm"
              hint="Driving plus charging plus queueing"
            />
            <StatTile
              label="Charging cost"
              value={
                recommendation.result.total_charging_cost_usd === undefined
                  ? 'n/a'
                  : numberOf(recommendation.result.total_charging_cost_usd, 2, '')
              }
              unit={recommendation.result.total_charging_cost_usd === undefined ? undefined : 'USD'}
              size="sm"
            />
          </div>

          <div className="rounded-md border border-slate-200 p-3">
            <span className="kv-term">Route</span>
            <p className="mt-1 break-words font-mono text-xs text-slate-800">
              {(recommendation.result.path || []).join(' → ') || '—'}
            </p>
          </div>

          {(recommendation.result.actions || []).length > 0 && (
            <div className="ai-table-container">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th className="num">Step</th>
                    <th>Action</th>
                    <th>From → to</th>
                    <th className="num">Distance</th>
                    <th className="num">Travel time</th>
                    <th className="num">Queue wait</th>
                    <th className="num">Energy</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendation.result.actions.map((step, i) => (
                    <tr key={i}>
                      <td className="num">{i + 1}</td>
                      <td className="font-medium text-slate-800">{step.action_type}</td>
                      <td className="col-code">
                        {step.edge?.source_id} → {step.edge?.target_id}
                      </td>
                      <td className="num">{numberOf(step.edge?.distance_km, 2, ' km')}</td>
                      <td className="num">{numberOf(step.edge?.travel_time_min, 1, ' min')}</td>
                      <td className="num">{numberOf(step.queue_wait_min, 1, ' min')}</td>
                      <td className="num">{numberOf(step.charging_kwh, 2, ' kWh')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

    </div>
  );
}
