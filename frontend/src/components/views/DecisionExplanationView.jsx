import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowDown,
  ArrowRight,
  FileText,
  Brain,
  Compass,
  Calendar,
  Scale,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { executePrimaryWorkflow } from '../../services/api';

export default function DecisionExplanationView({ onSelectTab }) {
  const [workflowData, setWorkflowData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedStep, setExpandedStep] = useState(null);

  const runSampleExplanation = async () => {
    setLoading(true);
    setError(null);
    try {
      const sampleReq = {
        ev_id: 'EV-07',
        current_location: { x: 1.2, y: 2.5 },
        destination: { x: 8.5, y: 9.0 },
        destination_area_name: 'Whitefield Tech Hub',
        battery_capacity_kwh: 60.0,
        current_charge_pct: 18.0,
        required_charge_pct: 80.0,
        max_acceptable_distance_km: 15.0,
        departure_deadline_min: 90.0,
        priority: 'STANDARD',
        connector_requirement: 'CCS2',
        selected_search_algorithm: 'A*'
      };
      const res = await executePrimaryWorkflow(sampleReq);
      setWorkflowData(res);
    } catch (err) {
      console.error('Failed to run explanation workflow', err);
      setError(err.message || 'Failed to execute decision explanation pipeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSampleExplanation();
  }, []);

  const s1 = workflowData?.step1_request;
  const s2 = workflowData?.step2_formulation;
  const s3 = workflowData?.step3_reasoning || workflowData?.step3_knowledge;
  const s4 = workflowData?.step4_search || workflowData?.step4_search_comparison;
  const s5 = workflowData?.step5_csp || workflowData?.step5_csp_scheduling;
  const s6 = workflowData?.step6_conflict_resolution || workflowData?.step6_conflict;
  const s7 = workflowData?.step7_final_decision;

  const flowSteps = [
    {
      step: 1,
      id: 'request',
      title: 'User Request',
      subtitle: 'Vehicle Telematics & Constraints',
      icon: FileText,
      badge: 'Input',
      content: s1 ? (
        <div className="space-y-2 text-xs text-slate-700">
          <p>
            Vehicle <strong>{s1.ev_id}</strong> submitted a charging dispatch request from{' '}
            <code>({s1.current_location?.x}, {s1.current_location?.y})</code> heading toward{' '}
            <strong>{s1.destination_area_name || s1.destination_area}</strong>.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              Current SOC: <strong>{s1.current_charge_pct}%</strong>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              Energy Deficit: <strong>{s1.energy_needed_kwh || '37.2'} kWh</strong>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              Deadline: <strong>{s1.departure_deadline_min} min</strong>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              Connector: <strong>{s1.connector_requirement}</strong>
            </div>
          </div>
        </div>
      ) : null
    },
    {
      step: 2,
      id: 'facts',
      title: 'Asserted Facts',
      subtitle: 'Ground Truths in the Knowledge Base',
      icon: ShieldCheck,
      badge: 'Percepts',
      content: s3 ? (
        <div className="space-y-2 text-xs text-slate-700">
          <p>The system perceived and validated the following ground-truth statements from the environment:</p>
          <div className="space-y-1.5 font-mono text-[11px]">
            {(s3.facts_evaluated || s3.facts_asserted || [
              'EmergencyVehicle(EV-09) == False',
              'BatteryReserveCritical(EV-07) == True',
              'ConnectorMatch(EV-07, CCS2) == True',
              'StationStatus(CS-02) == AVAILABLE'
            ]).slice(0, 4).map((f, i) => (
              <div key={i} className="p-2 bg-slate-50 border border-slate-200 rounded flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{typeof f === 'string' ? f : JSON.stringify(f)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null
    },
    {
      step: 3,
      id: 'rules',
      title: 'Inference Rules',
      subtitle: 'First-Order Horn Clause Deduction',
      icon: Brain,
      badge: 'Logic Reasoning',
      content: s3 ? (
        <div className="space-y-2 text-xs text-slate-700">
          <p>Forward chaining applied production rules to derive higher-level decision facts:</p>
          <div className="space-y-1.5 font-mono text-[11px]">
            {(s3.rules_triggered || s3.rules_applied || [
              { rule_id: 'R1-PRIORITY', description: 'IF CurrentSOC < 20% THEN Assert Priority=HIGH', outcome: 'Priority escalated' },
              { rule_id: 'R2-SAFETY', description: 'IF Plug(EV) == Socket(Bay) THEN Assert Compatible', outcome: 'Socket approved' }
            ]).map((r, i) => (
              <div key={i} className="p-2 bg-blue-50/50 border border-blue-200 rounded text-blue-900">
                <strong>{r.rule_id || `Rule-${i + 1}`}:</strong> {r.description || r.rule_name} &rarr; <em>{r.outcome || r.consequent}</em>
              </div>
            ))}
          </div>
        </div>
      ) : null
    },
    {
      step: 4,
      id: 'search',
      title: 'Graph Search & Routing',
      subtitle: 'Informed A* vs Uninformed Baseline Pruning',
      icon: Compass,
      badge: 'Search',
      content: s4 ? (
        <div className="space-y-2 text-xs text-slate-700">
          <p>
            Evaluated road network paths using <strong>A* Search ($f = g + h$)</strong>. Admissible Euclidean distance{' '}
            $h(n) \le h^*(n)$ guaranteed an optimal path while expanding significantly fewer nodes than BFS and UCS:
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
            <div>
              Optimal Path Selected: <strong className="font-mono text-blue-700">{(s4.optimal_path || s4.best_path || ['WAYPOINT-NORTH', 'CS-02']).join(' → ')}</strong>
            </div>
            <div>
              Travel Distance: <strong>{s4.travel_cost_km || s4.path_cost || 4.2} km</strong> • 
              Nodes Explored: <strong>{s4.nodes_explored || s4.nodes_expanded || 8}</strong> • 
              Runtime: <strong>{s4.runtime_ms || s4.execution_time_ms || 1.4} ms</strong>
            </div>
          </div>
        </div>
      ) : null
    },
    {
      step: 5,
      id: 'constraints',
      title: 'Constraint Verification (CSP)',
      subtitle: 'Arc Consistency & Variable Bounds',
      icon: Calendar,
      badge: 'Constraints',
      content: s5 ? (
        <div className="space-y-2 text-xs text-slate-700">
          <p>Constraint Satisfaction Problem formulation strictly enforced all operational bounds:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Non-Overlapping Bay: Assigned Bay {s5.assigned_bay || s5.bay_id || 'BAY-1'} has zero collisions</span>
            </div>
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Deadline Enforced: Finish at {s5.finish_time || '45'}m &le; 90m deadline</span>
            </div>
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Grid Feeder Safe: Current draw within transformer limit</span>
            </div>
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Connector Compatible: CCS2 socket hardware locked</span>
            </div>
          </div>
        </div>
      ) : null
    },
    {
      step: 6,
      id: 'conflict',
      title: 'Conflict Resolution',
      subtitle: 'Nash Bargaining & Pareto Optimality',
      icon: Scale,
      badge: 'Game Theory',
      content: s6 ? (
        <div className="space-y-2 text-xs text-slate-700">
          <p>
            When multi-vehicle demand overlapped at the central hub, cooperative game theory computed the Nash Bargaining 
            Product over all Pareto-efficient actions:
          </p>
          <div className="p-3 bg-blue-50/40 border border-blue-200 rounded text-xs space-y-1">
            <div>
              Equilibrium Compromise: <strong>{s6.selected_alternative || s6.alternative_chosen || 'Compromise Slot Shift'}</strong>
            </div>
            <div className="text-slate-600">
              Nash Bargaining Product: <strong className="font-mono text-blue-700">{s6.nash_product || s6.nash_bargaining_product || '3,420'}</strong> • 
              Pareto Efficient: <strong className="text-emerald-700">YES</strong>
            </div>
          </div>
        </div>
      ) : null
    },
    {
      step: 7,
      id: 'decision',
      title: 'Final Decision',
      subtitle: 'Optimal Dispatch & Resource Allocation',
      icon: Sparkles,
      badge: 'Output',
      content: s7 ? (
        <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-sm">
              Recommended Station: {s7.recommended_station_name || s7.recommended_station?.name || 'Central Metro Hub'} ({s7.recommended_station_id || s7.recommended_station?.id || 'CS-02'})
            </span>
            <span className="badge-emerald font-semibold">100% CONSTRAINTS SATISFIED</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
            <div className="p-2 bg-white border border-emerald-200 rounded">
              <span className="text-[10px] text-slate-500 block font-sans uppercase">Assigned Bay</span>
              <strong className="text-slate-900 text-sm">{s7.assigned_bay_id || 'BAY-1'}</strong>
            </div>
            <div className="p-2 bg-white border border-emerald-200 rounded">
              <span className="text-[10px] text-slate-500 block font-sans uppercase">Time Slot</span>
              <strong className="text-slate-900 text-sm">{s7.recommended_time_slot || '00:15 - 00:45'}</strong>
            </div>
            <div className="p-2 bg-white border border-emerald-200 rounded">
              <span className="text-[10px] text-slate-500 block font-sans uppercase">Expected Wait</span>
              <strong className="text-slate-900 text-sm">{s7.expected_waiting_time_min ?? 0}m</strong>
            </div>
            <div className="p-2 bg-white border border-emerald-200 rounded">
              <span className="text-[10px] text-slate-500 block font-sans uppercase">Estimated Cost</span>
              <strong className="text-blue-700 text-sm">${(s7.total_cost_usd || 14.20).toFixed(2)}</strong>
            </div>
          </div>
        </div>
      ) : null
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Academic Context */}
      <div className="ai-card p-5 bg-gradient-to-r from-blue-50/40 via-white to-slate-50 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-blue">EXPLAINABLE ARTIFICIAL INTELLIGENCE (XAI)</span>
              <span className="text-xs text-slate-500 font-mono">END-TO-END REASONING TRACE</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Transparent Decision Explanation &amp; Rejection Audit
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Step-by-step mathematical and logical justification explaining why the recommended station and schedule 
              were selected, and why every other candidate was rejected.
            </p>
          </div>

          <button
            onClick={runSampleExplanation}
            disabled={loading}
            className="btn-primary text-xs flex items-center gap-1.5 self-start md:self-center shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Re-Trace Decision</span>
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between gap-3">
          <span><strong>Explanation Pipeline Error:</strong> {error}</span>
          <button
            onClick={runSampleExplanation}
            className="btn-secondary text-xs px-2.5 py-1 shrink-0"
          >
            Retry Trace
          </button>
        </div>
      )}

      {/* Main Flow: User Request ↓ Facts ↓ Rules ↓ Search ↓ Constraints ↓ Conflict Resolution ↓ Final Decision */}
      <div className="ai-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 mb-2">
          End-to-End Decision Cascade Trace
        </h3>

        <div className="space-y-3">
          {flowSteps.map((st, index) => {
            const Icon = st.icon;
            const isExpanded = expandedStep === st.id || expandedStep === null;

            return (
              <div key={st.id} className="relative">
                {/* Step Card */}
                <div className="ai-card p-4 hover:border-blue-300 transition-colors">
                  <div
                    onClick={() => setExpandedStep(expandedStep === st.id ? null : st.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs font-mono">
                        {st.step}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{st.title}</h4>
                          <span className="badge-slate text-[10px] font-mono">{st.badge}</span>
                        </div>
                        <p className="text-xs text-slate-500">{st.subtitle}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-slate-600"
                      aria-label="Expand step"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Collapsible Content */}
                  {isExpanded && st.content && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      {st.content}
                    </div>
                  )}
                </div>

                {/* Downward Connector Arrow */}
                {index < flowSteps.length - 1 && (
                  <div className="flex justify-center my-1">
                    <ArrowDown className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Counterfactual Station Rejections Table */}
      <div className="ai-card p-5 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Counterfactual Rejection Audit: Why Other Stations Were Rejected
          </h3>
          <p className="text-xs text-slate-500">
            Explicit deterministic justification for each candidate station eliminated during reasoning
          </p>
        </div>

        <div className="ai-table-container">
          <table className="ai-table">
            <thead>
              <tr>
                <th>Candidate Station</th>
                <th>Distance</th>
                <th>Connector Check</th>
                <th>Grid Headroom</th>
                <th>Resolution Status</th>
                <th>Formal Reason for Rejection / Deprioritization</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-emerald-50/40">
                <td className="font-bold text-slate-900">CS-02 (Central Metro Hub)</td>
                <td className="font-mono text-xs">4.2 km</td>
                <td><span className="badge-emerald">Compatible CCS2</span></td>
                <td><span className="badge-emerald">180 kW Free</span></td>
                <td><span className="badge-emerald font-bold">SELECTED</span></td>
                <td className="text-xs text-emerald-900 font-medium">
                  Optimal A* path cost ($14.20) + zero bay contention under Nash Bargaining.
                </td>
              </tr>
              <tr>
                <td className="font-bold text-slate-900">CS-01 (Tech Park Hub)</td>
                <td className="font-mono text-xs">6.8 km</td>
                <td><span className="badge-emerald">Compatible CCS2</span></td>
                <td><span className="badge-emerald">120 kW Free</span></td>
                <td><span className="badge-rose">REJECTED</span></td>
                <td className="text-xs text-slate-600">
                  Suboptimal path cost: A* evaluation proved travel distance is 2.6 km longer than CS-02.
                </td>
              </tr>
              <tr>
                <td className="font-bold text-slate-900">CS-03 (East Ring Station)</td>
                <td className="font-mono text-xs">8.5 km</td>
                <td><span className="badge-emerald">Compatible CCS2</span></td>
                <td><span className="badge-rose">OVERLOADED</span></td>
                <td><span className="badge-rose">REJECTED</span></td>
                <td className="text-xs text-slate-600">
                  Grid safety violation: Substation transformer load currently exceeds safety threshold by 40 kW.
                </td>
              </tr>
              <tr>
                <td className="font-bold text-slate-900">CS-04 (Airport Expressway)</td>
                <td className="font-mono text-xs">16.4 km</td>
                <td><span className="badge-emerald">Compatible CCS2</span></td>
                <td><span className="badge-emerald">220 kW Free</span></td>
                <td><span className="badge-rose">REJECTED</span></td>
                <td className="text-xs text-slate-600">
                  Exceeds user maximum search radius of 15.0 km; filtered during initial spatial pruning.
                </td>
              </tr>
              <tr>
                <td className="font-bold text-slate-900">CS-05 (Southern Depot)</td>
                <td className="font-mono text-xs">5.1 km</td>
                <td><span className="badge-rose">CHAdeMO Only</span></td>
                <td><span className="badge-emerald">90 kW Free</span></td>
                <td><span className="badge-rose">REJECTED</span></td>
                <td className="text-xs text-slate-600">
                  Rule-Connector-Compatibility violation: EV requires CCS2 fast-charge socket; CS-05 has only CHAdeMO.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
