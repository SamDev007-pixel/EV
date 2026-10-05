import React, { useState, useEffect } from 'react';
import { compareSearchAlgorithms, recommendStation, fetchSearchNetwork } from '../../services/api';
import {
  Compass,
  CheckCircle2,
  Clock,
  Zap,
  MapPin,
  ArrowRight,
  Loader2,
  GitCompare,
  TrendingDown,
  Info
} from 'lucide-react';

export default function SearchComparisonView({ evs = [] }) {
  // Scenario state
  const [selectedEvId, setSelectedEvId] = useState('EV-07');
  const [batteryPct, setBatteryPct] = useState(15.0);
  const [deadlineMin, setDeadlineMin] = useState(90.0);
  const [batteryCapacity, setBatteryCapacity] = useState(60.0);
  const [targetBatteryPct, setTargetBatteryPct] = useState(80.0);

  // Results state
  const [networkGraph, setNetworkGraph] = useState(null);
  const [algorithmResults, setAlgorithmResults] = useState([]);
  const [recommendationData, setRecommendationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlgoTab, setSelectedAlgoTab] = useState('ALL');

  const isSocInvalid = parseFloat(batteryPct) >= parseFloat(targetBatteryPct);

  const loadPresetEV07 = () => {
    setSelectedEvId('EV-07');
    setBatteryPct(15.0);
    setDeadlineMin(90.0);
    setBatteryCapacity(60.0);
    setTargetBatteryPct(80.0);
    setError(null);
  };

  const runEvaluation = async () => {
    if (isSocInvalid) return;
    setLoading(true);
    setError(null);
    try {
      const scenarioPayload = {
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
        compareSearchAlgorithms(scenarioPayload),
        recommendStation(scenarioPayload)
      ]);

      setNetworkGraph(graphData);
      setAlgorithmResults(algoData.comparison_matrix || []);
      setRecommendationData(recData);
    } catch (err) {
      console.error('Failed to run search evaluation', err);
      setError(err.message || 'Failed to benchmark search algorithms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runEvaluation();
  }, [selectedEvId]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Academic Context */}
      <div className="ai-card p-5 bg-gradient-to-r from-blue-50/40 via-white to-slate-50 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-blue">UNIT II: SEARCH ALGORITHMS</span>
              <span className="text-xs text-slate-500 font-mono">INFORMED VS UNINFORMED SEARCH</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Search Algorithm Benchmark &amp; Path Optimization
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Comparative benchmark of five classical graph search algorithms on the road network: 
              Breadth-First Search (BFS), Depth-First Search (DFS), Uniform Cost Search (UCS), 
              Greedy Best-First Search (GBFS), and A* Search.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadPresetEV07}
              className="btn-secondary text-xs"
            >
              Benchmark EV-07
            </button>
            <button
              onClick={runEvaluation}
              disabled={loading}
              className="btn-primary text-xs flex items-center gap-1.5 shadow-xs"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Compass className="w-3.5 h-3.5" />
              )}
              <span>Re-Run Comparison</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Telematics Inputs */}
      <div className="ai-card p-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Vehicle Scenario Parameters
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <div>
            <label className="form-label">Vehicle ID</label>
            <select
              value={selectedEvId}
              onChange={(e) => setSelectedEvId(e.target.value)}
              className="form-input text-xs"
            >
              <option value="EV-07">EV-07 (Nexon EV)</option>
              {evs.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.id} ({ev.priority})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Current Battery SOC (%)</label>
            <input
              type="number"
              min="5"
              max="95"
              value={batteryPct}
              onChange={(e) => setBatteryPct(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          <div>
            <label className="form-label">Target Battery SOC (%)</label>
            <input
              type="number"
              min="50"
              max="100"
              value={targetBatteryPct}
              onChange={(e) => setTargetBatteryPct(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          <div>
            <label className="form-label">Deadline (min)</label>
            <input
              type="number"
              min="20"
              max="300"
              value={deadlineMin}
              onChange={(e) => setDeadlineMin(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          <div className="flex items-end col-span-2 sm:col-span-4 lg:col-span-1">
            <button
              onClick={runEvaluation}
              className="w-full btn-secondary text-xs py-2"
            >
              Update Parameters
            </button>
          </div>
        </div>
      </div>

      {/* Validation Warning */}
      {isSocInvalid && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
          <Info className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            <strong>Invalid Scenario:</strong> Target Battery SOC ({targetBatteryPct}%) must be strictly greater than Current SOC ({batteryPct}%).
          </span>
        </div>
      )}

      {/* Backend API Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Search Benchmark Error:</strong> {error}</span>
          </div>
          <button
            onClick={runEvaluation}
            className="btn-secondary text-xs px-2.5 py-1 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* CORE SPECIFICATION TABLE: Algorithm | Path Cost | Nodes Expanded | Runtime | Result */}
      <div className="ai-card p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Algorithm Comparison Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Exact comparative performance metrics for informed and uninformed search strategies
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs">
            {['ALL', 'A* Search', 'UCS', 'GBFS', 'BFS', 'DFS'].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedAlgoTab(tab)}
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  selectedAlgoTab === tab
                    ? 'bg-white text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="ai-table-container">
          <table className="ai-table">
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>Type</th>
                <th className="text-right">Path Cost ($ / km)</th>
                <th className="text-center">Nodes Expanded</th>
                <th className="text-right">Runtime (ms)</th>
                <th>Result (Chosen Station)</th>
                <th>Path Waypoints</th>
              </tr>
            </thead>
            <tbody>
              {algorithmResults.length > 0 ? (
                algorithmResults
                  .filter(res => selectedAlgoTab === 'ALL' || res.algorithm.includes(selectedAlgoTab))
                  .map((res) => {
                    const isAStar = res.algorithm === 'A* Search';
                    const isOptimal = res.algorithm === 'A* Search' || res.algorithm === 'UCS';

                  return (
                    <tr
                      key={res.algorithm}
                      className={isAStar ? 'bg-blue-50/40 font-semibold' : ''}
                    >
                      <td className="font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{res.algorithm}</span>
                          {isAStar && (
                            <span className="badge-blue text-[9px]">RECOMMENDED</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="text-xs text-slate-600">
                          {['A* Search', 'Greedy Best-First'].includes(res.algorithm) ? (
                            <span className="text-blue-700 font-medium">Informed ($f = g + h$)</span>
                          ) : (
                            <span className="text-slate-500">Uninformed</span>
                          )}
                        </span>
                      </td>

                      <td className="text-right font-mono font-bold text-slate-900">
                        {res.success && res.path_cost >= 0 ? `$${res.path_cost?.toFixed(2)}` : 'N/A'}
                      </td>

                      <td className="text-center font-mono">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-bold border border-slate-200">
                          {res.nodes_explored}
                        </span>
                      </td>

                      <td className="text-right font-mono text-slate-600">
                        {res.execution_time_ms} ms
                      </td>

                      <td>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          res.success ? 'badge-emerald' : 'badge-rose'
                        }`}>
                          {res.selected_station || 'No Goal Found'}
                        </span>
                      </td>

                      <td className="text-slate-500 font-mono text-[11px] max-w-xs truncate" title={res.path_names?.join(' → ')}>
                        {res.path_names?.join(' → ') || 'None'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Benchmarking algorithms across network graph...</span>
                      </span>
                    ) : (
                      <span>No benchmark results available. Click &ldquo;Re-Run Comparison&rdquo; to benchmark.</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mathematical Analysis & Admissibility Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs text-slate-700">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Info className="w-4 h-4 text-blue-600" />
            <span>Why A* Search is Strictly Optimal and Efficient:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
            <div className="p-2.5 bg-white border border-slate-200 rounded">
              <strong className="text-slate-900 block mb-0.5">1. Admissible Heuristic</strong>
              <p className="text-slate-600">
                The Euclidean distance heuristic $h(n) \le h^*(n)$ never overestimates the true travel distance, guaranteeing mathematical optimality.
              </p>
            </div>
            <div className="p-2.5 bg-white border border-slate-200 rounded">
              <strong className="text-slate-900 block mb-0.5">2. Significant Pruning</strong>
              <p className="text-slate-600">
                Unlike uninformed BFS and UCS which expand concentric waves across all directions, A* expands fewer states by guiding exploration toward the goal.
              </p>
            </div>
            <div className="p-2.5 bg-white border border-slate-200 rounded">
              <strong className="text-slate-900 block mb-0.5">3. Defeating Greedy Search</strong>
              <p className="text-slate-600">
                Greedy Best-First can be tricked by local detours and high tariffs because it ignores cumulative path cost $g(n)$, whereas A* balances $g(n) + h(n)$.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
