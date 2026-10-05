import React, { useState, useEffect } from 'react';
import { fetchCSPScenarios, solveCSPSchedule } from '../../services/api';
import {
  Calendar,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sliders,
  Clock,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';

export default function CSPSchedulerView() {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState('NORMAL_DEMAND');
  const [enableFC, setEnableFC] = useState(true);
  const [enableAC3, setEnableAC3] = useState(true);
  const [enableMRV, setEnableMRV] = useState(true);

  const [cspData, setCspData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('gantt');

  const defaultScenarios = [
    { id: 'NORMAL_DEMAND', name: 'Normal Demand (5 EVs, 4 Bays)', description: 'Balanced arrival distribution where all vehicles can be feasibly scheduled without preemption.' },
    { id: 'RUSH_HOUR', name: 'Rush Hour Contention (8 EVs, 4 Bays)', description: 'High arrival density exceeding immediate capacity. Tests MRV heuristic and constraint backtracking.' },
    { id: 'EMERGENCY_PREEMPTION', name: 'Emergency Preemption (Ambulance Arrival)', description: 'Critical emergency fleet vehicle requiring immediate guaranteed bay allocation.' }
  ];

  const displayScenarios = scenarios.length > 0 ? scenarios : defaultScenarios;

  const loadScenarios = async () => {
    try {
      const data = await fetchCSPScenarios();
      if (Array.isArray(data) && data.length > 0) {
        setScenarios(data);
      }
    } catch (err) {
      console.warn('CSP scenarios fetch notice:', err.message);
    }
  };

  const runCSPSolver = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await solveCSPSchedule({
        scenario_name: selectedScenario,
        enable_forward_checking: enableFC,
        enable_ac3: enableAC3,
        enable_mrv: enableMRV
      });
      setCspData(res);
    } catch (err) {
      console.error('Failed to run CSP solver', err);
      setError(err.message || 'Failed to generate CSP schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenarios();
    runCSPSolver();
  }, [selectedScenario]);

  const problemState = cspData?.problem_state;
  const solution = cspData?.solution;
  const assignments = solution?.best_assignment || {};
  const stats = solution?.stats;
  const utility = solution?.utility_score;

  const totalDuration = 180;
  const timeLabels = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Academic Context */}
      <div className="ai-card p-5 bg-gradient-to-r from-blue-50/40 via-white to-slate-50 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-blue">UNIT III: CONSTRAINT SATISFACTION</span>
              <span className="text-xs text-slate-500 font-mono">BACKTRACKING • MRV • LCV • AC-3</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Smart Charging Scheduler (CSP)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Discrete resource allocation mapping EV Requests $\to$ Stations $\to$ Charger Bays $\to$ 15-minute Time Slots 
              while strictly enforcing non-overlap, power limits, and departure deadlines.
            </p>
          </div>

          <button
            onClick={runCSPSolver}
            disabled={loading}
            className="btn-primary text-xs flex items-center gap-1.5 self-start md:self-center shadow-xs"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Execute CSP Solver</span>
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Scheduler Error:</strong> {error}</span>
          </div>
          <button
            onClick={runCSPSolver}
            className="btn-secondary text-xs px-2.5 py-1 shrink-0"
          >
            Retry Solver
          </button>
        </div>
      )}

      {/* Preset Scenarios Selector */}
      <div className="ai-card p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Select Fleet Contention Scenario
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {displayScenarios.map((sc) => {
            const isSelected = selectedScenario === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => setSelectedScenario(sc.id)}
                className={`p-3 text-left rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-50/60 border-blue-500 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <h4 className="font-bold text-xs text-slate-900 mb-1">{sc.name.split('(')[0]}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{sc.description}</p>
                </div>
                {isSelected && (
                  <span className="mt-2 text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                    <Check className="w-3 h-3 text-blue-600" /> Active Scenario
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Solver Options */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs">
          <span className="font-semibold text-slate-700">Constraint Propagation Techniques:</span>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={enableMRV}
                onChange={(e) => setEnableMRV(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span>MRV (Minimum Remaining Values)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={enableFC}
                onChange={(e) => setEnableFC(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span>Forward Checking</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={enableAC3}
                onChange={(e) => setEnableAC3(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span>AC-3 Arc Consistency</span>
            </label>
          </div>
        </div>
      </div>

      {/* Solver Telemetry Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="ai-card p-3 text-center">
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">Feasibility</span>
            <span className={`text-base font-bold ${solution?.is_feasible ? 'text-emerald-700' : 'text-rose-700'}`}>
              {solution?.is_feasible ? 'FEASIBLE' : 'INFEASIBLE (UNSAT)'}
            </span>
          </div>
          <div className="ai-card p-3 text-center">
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">Search Backtracks</span>
            <span className="text-base font-bold text-slate-900 font-mono">{stats.backtracks}</span>
          </div>
          <div className="ai-card p-3 text-center">
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">Constraint Checks</span>
            <span className="text-base font-bold text-slate-900 font-mono">{stats.constraint_checks}</span>
          </div>
          <div className="ai-card p-3 text-center">
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">Solver Runtime</span>
            <span className="text-base font-bold text-blue-600 font-mono">{stats.runtime_ms} ms</span>
          </div>
        </div>
      )}

      {/* Rationale / Conflict Banner */}
      {solution && (
        <div className={`p-4 border rounded-lg text-xs ${
          solution.is_feasible
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
            : 'bg-rose-50/60 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {solution.is_feasible ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <strong className="text-xs uppercase tracking-wider">
              {solution.is_feasible ? 'Optimal Schedule Formulation' : 'Constraint Bottleneck Detected'}
            </strong>
          </div>
          <p className="leading-relaxed text-xs pl-6">{solution.explanation}</p>
        </div>
      )}

      {/* Visual Gantt Timeline */}
      <div className="ai-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Charging Timeline Schedule (0 to 180 Minutes)</span>
            </h3>
            <p className="text-xs text-slate-500">Visual mapping of discrete 15-minute slot assignments</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-600"></span> Allocated Slot
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-500"></span> Departure Deadline
            </span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[850px] space-y-3">
            {/* Time Axis Header */}
            <div className="flex items-center font-mono text-[10px] text-slate-500 pb-2 border-b border-slate-200">
              <div className="w-48 shrink-0 font-bold uppercase tracking-wider pl-2 font-sans text-slate-700">
                Vehicle &amp; Priority
              </div>
              <div className="flex-1 flex justify-between relative px-2">
                {timeLabels.map((time) => (
                  <div key={time} className="text-center font-semibold">
                    {time}m
                  </div>
                ))}
              </div>
            </div>

            {/* Allocation Rows */}
            {Object.keys(problemState?.variables || {}).length > 0 ? (
              Object.entries(problemState?.variables || {}).map(([evId, evVar]) => {
                const assign = assignments[evId];
                const isEmergency = evVar.priority === 'EMERGENCY';
                const deadlinePercent = Math.min(100, Math.max(0, (evVar.departure_deadline / totalDuration) * 100));

                return (
                  <div key={evId} className="flex items-center text-xs py-2.5 border-b border-slate-100 hover:bg-slate-50/80 transition-colors px-2">
                    <div className="w-48 shrink-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-xs">{evId}</span>
                        <span className={`px-1.5 py-0.2 text-[9px] font-semibold rounded ${
                          isEmergency ? 'badge-rose' : 'badge-blue'
                        }`}>
                          {evVar.priority}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block truncate">
                        {assign ? `Bay ${assign.bay_id} @ ${assign.station_id}` : 'Unassigned (No Slot)'}
                      </span>
                    </div>

                    {/* Visual Bar Track */}
                    <div className="flex-1 h-8 bg-slate-100/70 border border-slate-200 rounded relative flex items-center">
                      {/* Deadline Marker */}
                      <div
                        style={{ left: `${deadlinePercent}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                        title={`Deadline: ${evVar.departure_deadline}m`}
                      />

                      {/* Assigned Slot Block */}
                      {assign && (
                        <div
                          style={{
                            left: `${(assign.start_time / totalDuration) * 100}%`,
                            width: `${(assign.duration / totalDuration) * 100}%`
                          }}
                          className={`absolute top-1 bottom-1 rounded shadow-xs flex items-center justify-center text-[10px] font-bold text-white z-0 ${
                            isEmergency ? 'bg-rose-600' : 'bg-blue-600'
                          }`}
                        >
                          <span className="truncate px-1 font-mono">
                            {assign.start_time}m - {assign.start_time + assign.duration}m ({assign.charging_rate_kw}kW)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Executing Backtracking CSP solver with MRV and AC-3...</span>
                  </span>
                ) : (
                  <span>No variable allocations available for this scenario. Click &ldquo;Execute CSP Solver&rdquo; to schedule.</span>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
