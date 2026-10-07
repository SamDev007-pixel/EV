import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  Brain,
  Compass,
  Calendar,
  Scale,
  Sparkles,
  Layers,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowRight
} from 'lucide-react';
import { executePrimaryWorkflow } from '../../services/api';
import { PageHeader, Section, StatTile, StateBlock, Banner } from '../common';

const SAMPLE_REQUEST = {
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

/** Renders a value, or an em dash when the backend did not report one. */
function show(value, digits) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return digits === undefined ? String(value) : value.toFixed(digits);
  return value;
}

function stringList(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

export default function DecisionExplanationView({ onSelectTab }) {
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkflow(await executePrimaryWorkflow(SAMPLE_REQUEST));
    } catch (err) {
      console.error('Failed to run the decision workflow', err);
      setWorkflow(null);
      setError(err.message || 'The decision pipeline could not be executed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
  }, []);

  const s1 = workflow?.step1_request;
  const s2 = workflow?.step2_formulation;
  const s3 = workflow?.step3_reasoning;
  const s4 = workflow?.step4_search;
  const s5 = workflow?.step5_csp;
  const s6 = workflow?.step6_conflict_resolution;
  const s7 = workflow?.step7_final_decision;
  const s8 = workflow?.step8_explanation;

  const rejected = (s4?.algorithms_compared || []).filter((a) => !a.selected);
  const constraintStatus = s7?.constraint_status || {};

  return (
    <div className="page">

      <PageHeader
        eyebrow="Pipeline · stage 9"
        title="Decision explanation and rejection audit"
        description="The full reasoning record for one request: what was asserted, which rules fired, what each search algorithm returned, how the schedule was constrained, how the conflict was arbitrated, and what was finally decided."
        actions={
          <>
            <button type="button" onClick={run} disabled={loading} className="btn-primary">
              <RotateCcw className="h-4 w-4" />
              {loading ? 'Running…' : 'Re-run trace'}
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('ev_request')}
              className="btn-secondary"
            >
              New request
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        }
      />

      {error && (
        <Banner
          variant="error"
          action={
            <button type="button" onClick={run} className="btn-secondary btn-sm">
              Retry
            </button>
          }
        >
          <strong>Explanation pipeline failed.</strong> {error}
        </Banner>
      )}

      {loading && !workflow && (
        <Section title="Running the pipeline">
          <StateBlock
            variant="loading"
            title="Executing search, scheduling, logic and game stages"
            detail="This view performs a real end-to-end run; the results below appear once it finishes."
          />
        </Section>
      )}

      {workflow && (
        <>
          {/* Run identity + headline metrics */}
          <Section
            title="Run record"
            description="Identifiers and measured cost of the run that produced this explanation."
          >
            <div className="stat-grid">
              <StatTile label="Workflow ID" value={workflow.workflow_id} size="sm" hint="Identifier of this end-to-end run" />
              <StatTile label="Decision ID" value={workflow.decision_id} size="sm" hint="Key of the stored explanation record" />
              <StatTile
                label="Pipeline runtime"
                value={show(workflow.execution_time_ms, 1)}
                unit="ms"
                tone="primary"
              />
              <StatTile
                label="Decision score"
                value={show(s7?.decision_confidence_score, 1)}
                unit={s7?.decision_confidence_score !== undefined ? '/100' : undefined}
                tone="success"
                hint={s7?.score_formula || 'Composite score produced by the decision stage'}
              />
            </div>
          </Section>

          {/* Stage 1 - request */}
          <StageCard
            step="01"
            icon={FileText}
            title="Request received"
            subtitle="What the user asked for"
          >
            {s1 ? (
              <>
                <p className="text-xs leading-relaxed text-slate-600">
                  Vehicle <strong className="text-slate-900">{s1.ev_id}</strong> starting at (
                  {show(s1.current_location?.x, 1)}, {show(s1.current_location?.y, 1)}) travelling to{' '}
                  <strong className="text-slate-900">{show(s1.destination_area)}</strong> at (
                  {show(s1.destination?.x, 1)}, {show(s1.destination?.y, 1)}).
                </p>
                <div className="stat-grid">
                  <StatTile label="Current SOC" value={show(s1.current_charge_pct, 0)} unit="%" size="sm" />
                  <StatTile label="Target SOC" value={show(s1.required_charge_pct, 0)} unit="%" size="sm" />
                  <StatTile
                    label="Energy required"
                    value={show(s1.energy_needed_kwh, 1)}
                    unit="kWh"
                    size="sm"
                    hint={`Battery capacity ${show(s1.battery_capacity_kwh, 0)} kWh`}
                  />
                  <StatTile
                    label="Deadline"
                    value={show(s1.departure_deadline_min, 0)}
                    unit="min"
                    size="sm"
                    hint={`Priority ${show(s1.priority)} · connector ${show(s1.connector_requirement)}`}
                  />
                </div>
              </>
            ) : (
              <StateBlock variant="info" title="Not reported by this run" />
            )}
          </StageCard>

          {/* Stage 2 - formulation */}
          <StageCard
            step="02"
            icon={Layers}
            title="Problem formulation"
            subtitle="Search problem the engine built from the request"
          >
            {s2 ? (
              <>
                <p className="text-xs leading-relaxed text-slate-600">{show(s2.problem_type)}</p>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-md border border-slate-200 p-3">
                    <span className="kv-term">Initial state</span>
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words font-mono text-2xs leading-relaxed text-slate-700">
                      {JSON.stringify(s2.initial_state, null, 1)}
                    </pre>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <span className="kv-term">Goal test</span>
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words font-mono text-2xs leading-relaxed text-slate-700">
                      {JSON.stringify(s2.goal_state, null, 1)}
                    </pre>
                  </div>
                </div>
                {stringList(s2.actions).length > 0 && (
                  <div>
                    <span className="kv-term">Action space</span>
                    <ul className="mt-1.5 space-y-1">
                      {stringList(s2.actions).map((a) => (
                        <li key={a} className="font-mono text-2xs leading-relaxed text-slate-600">
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s2.state_space_description && (
                  <p className="rounded-md bg-slate-50 p-3 font-mono text-2xs leading-relaxed text-slate-600">
                    {s2.state_space_description}
                  </p>
                )}
              </>
            ) : (
              <StateBlock variant="info" title="Not reported by this run" />
            )}
          </StageCard>

          {/* Stage 3 - facts and rules */}
          <StageCard
            step="03"
            icon={ShieldCheck}
            title="Facts asserted and rules fired"
            subtitle="Knowledge base state before the algorithms ran"
          >
            {s3 ? (
              <>
                <div className="stat-grid">
                  <StatTile
                    label="Facts asserted"
                    value={(s3.facts_asserted || []).length}
                    size="sm"
                    hint="Read from the request, the simulation and the station dataset"
                  />
                  <StatTile
                    label="Rules evaluated"
                    value={(s3.rules_evaluated || []).length}
                    size="sm"
                  />
                  <StatTile
                    label="Rules fired"
                    value={(s3.rules_fired || []).length}
                    size="sm"
                    tone="success"
                    hint={stringList(s3.rules_fired).join(', ') || 'No rule antecedent was satisfied'}
                  />
                  <StatTile
                    label="Computed priority"
                    value={show(s3.computed_priority)}
                    size="sm"
                    hint="Derived by inference, not taken verbatim from the request"
                  />
                </div>

                {s3.explanation && (
                  <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                    {s3.explanation}
                  </p>
                )}

                {(s3.facts_asserted || []).length > 0 && (
                  <div className="ai-table-container">
                    <table className="ai-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Predicate</th>
                          <th>Value</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s3.facts_asserted.map((f, i) => (
                          <tr key={`${f.subject}-${f.predicate}-${i}`}>
                            <td className="col-code">{f.subject}</td>
                            <td className="col-code">{f.predicate}</td>
                            <td className="font-medium text-slate-800">{show(f.value)}</td>
                            <td>
                              <span className="badge-slate">{f.source}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <StateBlock variant="info" title="Not reported by this run" />
            )}
          </StageCard>

          {/* Stage 4 - search */}
          <StageCard
            step="04"
            icon={Compass}
            title="Search over the charging network"
            subtitle="Every algorithm was run on the same graph"
          >
            {s4 ? (
              <>
                <p className="text-xs leading-relaxed text-slate-600">{s4.explanation}</p>
                <div className="ai-table-container">
                  <table className="ai-table">
                    <thead>
                      <tr>
                        <th>Algorithm</th>
                        <th className="num">Path cost</th>
                        <th className="num">Nodes expanded</th>
                        <th className="num">Heuristic</th>
                        <th className="num">Runtime</th>
                        <th className="col-center">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(s4.algorithms_compared || []).map((a) => (
                        <tr key={a.algorithm} className={a.selected ? 'row-selected' : ''}>
                          <td className="font-semibold text-slate-900">{a.algorithm}</td>
                          <td className="num">{show(a.path_cost, 4)}</td>
                          <td className="num">{show(a.nodes_explored)}</td>
                          <td className="num">{a.heuristic_value === null ? 'n/a' : show(a.heuristic_value, 3)}</td>
                          <td className="num">{show(a.runtime_ms, 2)} ms</td>
                          <td className="col-center">
                            {a.selected ? (
                              <span className="badge-emerald">Selected</span>
                            ) : (
                              <span className="badge-slate">Not selected</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-md border border-slate-200 p-3">
                    <span className="kv-term">Chosen path</span>
                    <p className="mt-1 break-words font-mono text-xs text-slate-800">
                      {stringList(s4.chosen_path).join(' → ') || '—'}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <span className="kv-term">Chosen station</span>
                    <p className="mt-1 text-xs text-slate-800">
                      {show(s4.chosen_station_name)}{' '}
                      <span className="col-code">{show(s4.chosen_station_id)}</span>
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <StateBlock variant="info" title="Not reported by this run" />
            )}
          </StageCard>

          {/* Stage 5 - CSP */}
          <StageCard
            step="05"
            icon={Calendar}
            title="Schedule constraints enforced"
            subtitle="Variables, domains and the assignment the solver returned"
          >
            {s5 ? (
              <>
                <div className="stat-grid">
                  <StatTile
                    label="Variables"
                    value={(s5.variables || []).length}
                    size="sm"
                    hint="Vehicles the solver had to place"
                  />
                  <StatTile
                    label="Domain values"
                    value={show(s5.domain_values_generated)}
                    size="sm"
                    hint={`${show(s5.solutions_found_count)} complete solution(s) found`}
                  />
                  <StatTile
                    label="Backtracks"
                    value={show(s5.backtracks_count)}
                    size="sm"
                    tone={s5.backtracking_used ? 'warning' : 'success'}
                    hint={s5.backtracking_used ? 'Search had to undo partial assignments' : 'No backtracking was required'}
                  />
                  <StatTile
                    label="Constraint checks"
                    value={show(s5.constraint_checks_count)}
                    size="sm"
                    hint={`AC-3 examined ${show(s5.ac3_values_examined)} values and pruned ${show(s5.ac3_values_pruned)}`}
                  />
                </div>

                {s5.assigned_schedule && (
                  <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3">
                    <span className="kv-term">Assignment for this request</span>
                    <div className="kv-grid mt-1.5">
                      {Object.entries(s5.assigned_schedule).map(([key, value]) => (
                        <div key={key}>
                          <dt className="kv-term">{key}</dt>
                          <dd className="kv-value font-mono">{show(value)}</dd>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {s5.utility_breakdown && (
                  <div className="ai-table-container">
                    <table className="ai-table">
                      <thead>
                        <tr>
                          <th>Penalty component</th>
                          <th className="num">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(s5.utility_breakdown).map(([key, value]) => (
                          <tr key={key}>
                            <td className="text-slate-700">
                              {key.replace(/_/g, ' ')}
                            </td>
                            <td className="num font-mono">{show(value, 2)}</td>
                          </tr>
                        ))}
                        <tr className="row-selected">
                          <td className="font-semibold text-slate-900">Total utility score</td>
                          <td className="num font-mono font-bold">{show(s5.utility_score, 2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {s5.explanation && (
                  <p className="text-xs leading-relaxed text-slate-600">{s5.explanation}</p>
                )}
              </>
            ) : (
              <StateBlock variant="info" title="Not reported by this run" />
            )}
          </StageCard>

          {/* Stage 6 - conflict */}
          <StageCard
            step="06"
            icon={Scale}
            title="Conflict resolution"
            subtitle="Competition for a bay, and how it was arbitrated"
          >
            {s6 ? (
              <>
                {s6.conflict_detected ? (
                  <Banner variant="warn">
                    <strong>Resource contention detected.</strong> {show(s6.contested_resource)}
                    {s6.competing_ev_id ? ` is also required by ${s6.competing_ev_id}.` : ''}
                  </Banner>
                ) : (
                  <Banner variant="ok">
                    No contention was detected for the selected resource in this run.
                  </Banner>
                )}

                <div className="stat-grid">
                  <StatTile
                    label="Decision method"
                    value={s6.decision_method ? 'Nash bargaining' : 'n/a'}
                    size="sm"
                    hint={s6.decision_method}
                  />
                  <StatTile label="Selected alternative" value={show(s6.selected_alternative_id)} size="sm" />
                  <StatTile
                    label="Nash product"
                    value={show(s6.nash_product, 2)}
                    size="sm"
                    tone="primary"
                    hint="Product of gains over each agent's disagreement point"
                  />
                  <StatTile
                    label="Pareto efficient"
                    value={s6.is_pareto_efficient ? 'Yes' : 'No'}
                    size="sm"
                    tone={s6.is_pareto_efficient ? 'success' : 'warning'}
                  />
                </div>

                {(s6.alternatives_evaluated || []).length > 0 && (
                  <div className="ai-table-container">
                    <table className="ai-table">
                      <thead>
                        <tr>
                          <th>Alternative</th>
                          <th className="num">EV agent</th>
                          <th className="num">Station agent</th>
                          <th className="num">Grid agent</th>
                          <th className="num">Energy agent</th>
                          <th className="col-center">Chosen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s6.alternatives_evaluated.map((alt) => {
                          const u = alt.utilities || {};
                          const isChosen = alt.alternative_id === s6.selected_alternative_id;
                          return (
                            <tr key={alt.alternative_id} className={isChosen ? 'row-selected' : ''}>
                              <td>
                                <div className="font-medium text-slate-900">
                                  {alt.alternative_title || alt.alternative_id}
                                </div>
                                <div className="col-code">{alt.alternative_id}</div>
                              </td>
                              <td className="num font-mono">{show(u.EV_AGENT, 1)}</td>
                              <td className="num font-mono">{show(u.STATION_AGENT, 1)}</td>
                              <td className="num font-mono">{show(u.GRID_AGENT, 1)}</td>
                              <td className="num font-mono">{show(u.ENERGY_AGENT, 1)}</td>
                              <td className="col-center">
                                {isChosen ? (
                                  <span className="badge-emerald">Chosen</span>
                                ) : (
                                  <span className="badge-slate">Rejected</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {s6.rational_justification && (
                  <p className="text-xs leading-relaxed text-slate-600">{s6.rational_justification}</p>
                )}
              </>
            ) : (
              <StateBlock variant="info" title="Not reported by this run" />
            )}
          </StageCard>

          {/* Stage 7 - final decision */}
          <StageCard
            step="07"
            icon={Sparkles}
            title="Final decision"
            subtitle="What the system actually recommends"
          >
            {s7 ? (
              <>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="kv-term">Recommended station</span>
                      <p className="mt-0.5 text-base font-bold text-slate-900">
                        {show(s7.recommended_station?.station_name)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {show(s7.recommended_station?.station_id)} ·{' '}
                        {show(s7.recommended_station?.operator)} ·{' '}
                        {show(s7.recommended_station?.distance_km, 2)} km away
                      </p>
                    </div>
                    <span className="badge-emerald">
                      Score {show(s7.decision_confidence_score, 1)}/100
                    </span>
                  </div>

                  <p className="mt-3 break-words font-mono text-2xs text-slate-600">
                    Route: {stringList(s7.recommended_route).join(' → ') || '—'}
                  </p>
                </div>

                <div className="stat-grid">
                  <StatTile label="Time slot" value={show(s7.recommended_time_slot)} size="sm" />
                  <StatTile
                    label="Expected wait"
                    value={show(s7.expected_waiting_time_min, 1)}
                    unit="min"
                    size="sm"
                  />
                  <StatTile
                    label="Charging duration"
                    value={show(s7.estimated_charging_duration_min, 0)}
                    unit="min"
                    size="sm"
                  />
                  <StatTile
                    label="Station data source"
                    value={show(s7.recommended_station?.data_source)}
                    size="sm"
                    hint="Provenance of the station metadata"
                  />
                </div>

                {Object.keys(constraintStatus).length > 0 && (
                  <div className="space-y-2">
                    <span className="kv-term">Constraint verdicts</span>
                    {Object.entries(constraintStatus).map(([name, verdict]) => {
                      const passed = String(verdict).toUpperCase().startsWith('PASSED');
                      return (
                        <div
                          key={name}
                          className="flex items-start gap-2 rounded-md border border-slate-200 p-3"
                        >
                          {passed ? (
                            <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <XCircle className="mt-px h-4 w-4 shrink-0 text-rose-600" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800">
                              {name.replace(/_/g, ' ')}
                            </p>
                            <p className="mt-0.5 text-2xs leading-relaxed text-slate-600">
                              {String(verdict)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {s7.reasoning_explanation && (
                  <p className="text-xs leading-relaxed text-slate-600">
                    {s7.reasoning_explanation}
                  </p>
                )}
              </>
            ) : (
              <StateBlock variant="info" title="Not reported by this run" />
            )}
          </StageCard>

          {/* Stage 8 - narrative explanation */}
          <StageCard
            step="08"
            icon={Brain}
            title="Explanation"
            subtitle="The same reasoning expressed in plain language"
          >
            {s8 ? (
              <>
                <p className="text-sm font-semibold text-slate-900">{show(s8.prompt)}</p>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {[
                    ['Facts', s8.facts_tier],
                    ['Rules', s8.rules_tier],
                    ['Search', s8.search_tier],
                    ['Constraints', s8.constraints_tier],
                    ['Decision', s8.decision_tier]
                  ].map(([label, tier]) => (
                    <div key={label} className="rounded-md border border-slate-200 p-3">
                      <span className="kv-term">{label}</span>
                      {stringList(tier).length === 0 ? (
                        <p className="mt-1 text-2xs text-slate-400">Not reported for this run.</p>
                      ) : (
                        <ul className="mt-1.5 space-y-1">
                          {stringList(tier).map((line) => (
                            <li
                              key={line}
                              className="text-2xs leading-relaxed text-slate-600"
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {stringList(s8.derivation_chain).length > 0 && (
                  <div>
                    <span className="kv-term">Derivation chain</span>
                    <ol className="mt-2 space-y-1.5 border-l-2 border-slate-200 pl-4">
                      {stringList(s8.derivation_chain).map((line, i) => (
                        <li key={i} className="relative text-2xs leading-relaxed text-slate-600">
                          <span className="absolute -left-[1.32rem] top-1.5 h-2 w-2 rounded-full bg-blue-500" />
                          {line}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            ) : (
              <StateBlock variant="info" title="Not reported by this run" />
            )}
          </StageCard>

          {/* Rejection audit */}
          <Section
            title="Rejection audit"
            description="What was considered and set aside, with the measurement that decided it."
          >
            {rejected.length === 0 ? (
              <StateBlock
                variant="empty"
                title="No alternative was rejected in this run"
                detail="Every compared algorithm returned the same selected path."
              />
            ) : (
              <div className="ai-table-container">
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th>Rejected option</th>
                      <th className="num">Path cost</th>
                      <th className="num">Nodes expanded</th>
                      <th>Reason it was not selected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejected.map((a) => {
                      const cost = Number(a.path_cost);
                      const chosenCost = Number(s4?.chosen_path_cost);
                      let reason = 'Returned a higher path cost than the selected algorithm.';
                      if (Number.isFinite(cost) && Number.isFinite(chosenCost)) {
                        if (cost === chosenCost) {
                          reason = `Found the same optimal cost (${cost.toFixed(4)}) but expanded more nodes, so it was not preferred.`;
                        } else if (cost > chosenCost) {
                          reason = `Path cost ${cost.toFixed(4)} is higher than the selected ${chosenCost.toFixed(4)}.`;
                        }
                      }
                      return (
                        <tr key={a.algorithm}>
                          <td className="font-semibold text-slate-900">{a.algorithm}</td>
                          <td className="num">{show(a.path_cost, 4)}</td>
                          <td className="num">{show(a.nodes_explored)}</td>
                          <td className="text-slate-600">{reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

    </div>
  );
}

/** One numbered stage of the cascade, with a consistent header block. */
function StageCard({ step, icon: Icon, title, subtitle, children }) {
  return (
    <section className="ai-card section">
      <div className="section-head">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 font-mono text-2xs font-bold text-slate-500">
            {step}
          </span>
          <div className="min-w-0">
            <h2 className="section-title">
              <Icon className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{title}</span>
            </h2>
            {subtitle && <p className="section-desc">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
