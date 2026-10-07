import React, { useState, useEffect, useCallback } from 'react';
import { fetchCSPScenarios, solveCSPSchedule } from '../../services/api';
import { PageHeader, Section, StatTile, StateBlock, Banner } from '../common';
import { Calendar, Play, Loader2, AlertCircle, Check, Table2, Info } from 'lucide-react';

const TIMELINE_MINUTES = 180;

function timelineLabels(step = 15) {
  const labels = [];
  for (let t = 0; t <= TIMELINE_MINUTES; t += step) labels.push(t);
  return labels;
}

export default function CSPSchedulerView() {
  const [scenarios, setScenarios] = useState([]);
  const [scenariosLoaded, setScenariosLoaded] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState('NORMAL_DEMAND');

  const [enableFC, setEnableFC] = useState(true);
  const [enableAC3, setEnableAC3] = useState(true);
  const [enableMRV, setEnableMRV] = useState(true);
  const [enableLCV, setEnableLCV] = useState(true);

  const [cspData, setCspData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('timeline');

  const problemState = cspData?.problem_state;
  const solution = cspData?.solution;
  const assignments = solution?.best_assignment || {};
  const stats = solution?.stats;
  const utility = solution?.utility_score;

  const loadScenarios = useCallback(async () => {
    try {
      const data = await fetchCSPScenarios();
      const list = Array.isArray(data) ? data : [];
      setScenarios(list);
      if (list.length > 0 && !list.some((s) => s.id === selectedScenario)) {
        setSelectedScenario(list[0].id);
      }
    } catch (err) {
      console.warn('CSP scenario list unavailable:', err.message);
      setScenarios([]);
    } finally {
      setScenariosLoaded(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runSolver = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await solveCSPSchedule({
        scenario_name: selectedScenario,
        enable_forward_checking: enableFC,
        enable_ac3: enableAC3,
        enable_mrv: enableMRV,
        enable_lcv: enableLCV
      });
      setCspData(res);
    } catch (err) {
      console.error('Failed to run the CSP solver', err);
      setCspData(null);
      setError(err.message || 'The scheduler could not produce a solution.');
    } finally {
      setLoading(false);
    }
  }, [selectedScenario, enableFC, enableAC3, enableMRV, enableLCV]);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  useEffect(() => {
    runSolver();
  }, [runSolver]);

  const variables = Object.entries(problemState?.variables || {});
  const violated = stats?.violated_constraints_summary || [];

  return (
    <div className="page">

      <PageHeader
        eyebrow="Pipeline · stage 5"
        title="Charging schedule as a constraint satisfaction problem"
        description="Vehicles are assigned to a charger and a 15-minute time slot while the solver enforces bay non-overlap, station power capacity, connector compatibility and departure deadlines."
        actions={
          <>
            <button type="button" onClick={runSolver} disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {loading ? 'Solving…' : 'Solve schedule'}
            </button>
          </>
        }
      />

      {error && (
        <Banner
          variant="error"
          action={
            <button type="button" onClick={runSolver} className="btn-secondary btn-sm">
              Retry solver
            </button>
          }
        >
          <strong>Scheduler error.</strong> {error}
        </Banner>
      )}

      {/* Scenario selection + solver options */}
      <Section
        title="Scenario and propagation techniques"
        description="Techniques can be switched off individually to see their effect on backtracks and constraint checks."
      >
        {scenariosLoaded && scenarios.length === 0 ? (
          <StateBlock
            variant="error"
            title="No scheduling scenario could be loaded"
            detail="The scheduler service did not return any scenario definition."
            action={
              <button type="button" onClick={loadScenarios} className="btn-secondary btn-sm">
                Retry
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {scenarios.map((sc) => {
              const isSelected = selectedScenario === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setSelectedScenario(sc.id)}
                  className={`flex flex-col rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50/60'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{sc.name}</span>
                    {isSelected && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />}
                  </span>
                  <span className="mt-1 block text-2xs leading-relaxed text-slate-500">
                    {sc.description}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <span className="kv-term">Solver techniques</span>
          {[
            ['MRV (minimum remaining values)', enableMRV, setEnableMRV],
            ['LCV (least constraining value)', enableLCV, setEnableLCV],
            ['Forward checking', enableFC, setEnableFC],
            ['AC-3 arc consistency', enableAC3, setEnableAC3]
          ].map(([label, checked, setter]) => (
            <label key={label} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setter(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              {label}
            </label>
          ))}
        </div>
      </Section>

      {/* Outcome */}
      {loading && !cspData ? (
        <Section title="Solving">
          <StateBlock
            variant="loading"
            title="Running backtracking search"
            detail="The solver is exploring the variable ordering and slot domains."
          />
        </Section>
      ) : solution ? (
        <>
          <Section
            title="Solver outcome"
            description={solution.explanation}
          >
            <div className="stat-grid">
              <StatTile
                label="Feasibility"
                value={solution.is_feasible ? 'Feasible' : 'Infeasible'}
                tone={solution.is_feasible ? 'success' : 'danger'}
                hint={
                  solution.is_feasible
                    ? `${assignments ? Object.keys(assignments).length : 0} vehicles placed`
                    : 'No assignment satisfies every hard constraint'
                }
              />
              <StatTile
                label="Backtracks"
                value={stats?.backtracks_count ?? 'n/a'}
                tone={stats?.backtracks_count > 0 ? 'warning' : 'success'}
                hint={stats?.backtracks_count > 0 ? 'Partial assignments were undone' : 'First descent reached a solution'}
              />
              <StatTile
                label="Constraint checks"
                value={stats?.constraint_checks_count ?? 'n/a'}
                hint={`${stats?.domain_values_generated ?? 0} domain values generated`}
              />
              <StatTile
                label="Solver runtime"
                value={stats?.execution_time_ms ?? 'n/a'}
                unit="ms"
                tone="primary"
                hint={`${stats?.solutions_found_count ?? 0} complete solution(s) found`}
              />
            </div>

            {violated.length > 0 && (
              <Banner variant="warn">
                <strong>{violated.length} constraint violation(s) were recorded while searching.</strong>{' '}
                The solver backtracked past them; they are listed below for traceability.
              </Banner>
            )}
          </Section>

          {/* Views */}
          <div className="flex items-center justify-between">
            <div className="tabs" role="tablist" aria-label="Scheduler view">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'timeline'}
                onClick={() => setView('timeline')}
                className="tab"
              >
                <Calendar className="h-3.5 w-3.5" />
                Timeline
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'assignments'}
                onClick={() => setView('assignments')}
                className="tab"
              >
                <Table2 className="h-3.5 w-3.5" />
                Assignments
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'details'}
                onClick={() => setView('details')}
                className="tab"
              >
                <Info className="h-3.5 w-3.5" />
                Solver detail
              </button>
            </div>
          </div>

          {view === 'timeline' && (
            <Section
              title="Charging timeline"
              description={`Each bar is one assignment on one charger between 0 and ${TIMELINE_MINUTES} minutes; the amber line marks that vehicle's departure deadline.`}
            >
              {variables.length === 0 ? (
                <StateBlock
                  variant="empty"
                  title="No scheduling variables in this scenario"
                  detail="The scenario produced no vehicle variables to place."
                />
              ) : (
                <div className="ai-card-flat overflow-x-auto p-3">
                  <div className="min-w-[880px]">
                    {/* Time axis */}
                    <div className="flex border-b border-slate-200 pb-2">
                      <div className="w-52 shrink-0 pr-3">
                        <span className="kv-term">Vehicle and deadline</span>
                      </div>
                      <div className="relative flex flex-1 justify-between px-1">
                        {timelineLabels().map((t) => (
                          <span
                            key={t}
                            className="font-mono text-2xs font-semibold text-slate-400"
                          >
                            {t}m
                          </span>
                        ))}
                      </div>
                    </div>

                    {variables.map(([evId, variable]) => {
                      const assign = assignments[evId];
                      const deadline = Number(variable.departure_deadline);
                      const deadlinePercent = Number.isFinite(deadline)
                        ? Math.min(100, Math.max(0, (deadline / TIMELINE_MINUTES) * 100))
                        : null;
                      const start = Number(assign?.start_time_min);
                      const duration = Number(assign?.duration_min);
                      const hasBar = Number.isFinite(start) && Number.isFinite(duration) && duration > 0;
                      const isEmergency = variable.priority === 'EMERGENCY';

                      return (
                        <div
                          key={evId}
                          className="flex items-center border-b border-slate-100 py-2.5 last:border-0"
                        >
                          <div className="w-52 shrink-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900">
                                {evId}
                              </span>
                              <span className={isEmergency ? 'badge-rose' : 'badge-blue'}>
                                {variable.priority}
                              </span>
                            </div>
                            <span className="mt-0.5 block truncate text-2xs text-slate-500">
                              {assign
                                ? `${assign.charger_id} · ${assign.power_kw} kW`
                                : 'No charger assigned'}
                            </span>
                          </div>

                          <div className="relative h-8 flex-1 rounded border border-slate-200 bg-slate-50">
                            {deadlinePercent !== null && (
                              <div
                                className="absolute inset-y-0 z-10 w-0.5 bg-amber-500"
                                style={{ left: `${deadlinePercent}%` }}
                                title={`Departure deadline ${deadline} min`}
                              />
                            )}

                            {hasBar && (
                              <div
                                className={`absolute inset-y-1 z-0 flex items-center justify-center rounded text-2xs font-bold text-white ${
                                  isEmergency ? 'bg-rose-600' : 'bg-blue-600'
                                }`}
                                style={{
                                  left: `${(start / TIMELINE_MINUTES) * 100}%`,
                                  width: `${(duration / TIMELINE_MINUTES) * 100}%`
                                }}
                                title={`${assign.charger_id} · ${start}m to ${start + duration}m at ${assign.power_kw} kW`}
                              >
                                <span className="truncate px-1 font-mono">
                                  {start}–{start + duration}m
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          )}

          {view === 'assignments' && (
            <Section
              title="Assignments"
              description="The complete schedule the solver returned, one row per vehicle."
            >
              {Object.keys(assignments).length === 0 ? (
                <StateBlock
                  variant="empty"
                  title="No feasible assignment"
                  detail="The solver could not place any vehicle in this scenario."
                />
              ) : (
                <div className="ai-table-container">
                  <table className="ai-table">
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>Priority</th>
                        <th>Station</th>
                        <th>Charger</th>
                        <th className="num">Start</th>
                        <th className="num">Duration</th>
                        <th className="num">Power</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(assignments).map(([evId, a]) => (
                        <tr key={evId}>
                          <td className="col-code">{evId}</td>
                          <td>
                            <span
                              className={
                                problemState?.variables?.[evId]?.priority === 'EMERGENCY'
                                  ? 'badge-rose'
                                  : 'badge-blue'
                              }
                            >
                              {problemState?.variables?.[evId]?.priority || '—'}
                            </span>
                          </td>
                          <td className="col-code">{a.station_id}</td>
                          <td className="col-code">{a.charger_id}</td>
                          <td className="num">{a.start_time_min} min</td>
                          <td className="num">{a.duration_min} min</td>
                          <td className="num">{a.power_kw} kW</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {view === 'details' && (
            <>
              <Section
                title="Search statistics"
                description="Counters recorded by the backtracking search for this run."
              >
                <div className="ai-table-container">
                  <table className="ai-table">
                    <thead>
                      <tr>
                        <th>Counter</th>
                        <th className="num">Value</th>
                        <th>Meaning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Domain values generated', stats?.domain_values_generated, 'Candidate (charger, slot) pairs before propagation'],
                        ['Solutions found', stats?.solutions_found_count, 'Complete assignments that satisfied every constraint'],
                        ['Maximum search depth', stats?.max_search_depth, 'Deepest partial assignment reached'],
                        ['Forward-checking prunes', stats?.forward_check_prunes, 'Values removed by forward checking'],
                        ['Forward-checking wipe-outs', stats?.forward_check_wipeouts, 'Domain emptied, forcing a backtrack'],
                        ['AC-3 revisions', stats?.ac3_revisions, 'Arc revision operations performed'],
                        ['AC-3 values examined', stats?.ac3_values_examined, 'Values inspected during arc consistency'],
                        ['AC-3 values pruned', stats?.ac3_values_pruned, 'Values removed by arc consistency'],
                        ['Values rejected during ordering', stats?.value_choices_rejected, 'Candidate values skipped by value ordering'],
                        ['Search budget nodes', stats?.search_budget_nodes, 'Node budget available for this solve'],
                        ['Search budget exhausted', String(stats?.search_budget_exhausted), 'Whether the budget stopped the search early']
                      ]
                        .filter(([, value]) => value !== undefined && value !== null)
                        .map(([label, value, meaning]) => (
                          <tr key={label}>
                            <td className="font-medium text-slate-800">{label}</td>
                            <td className="num font-mono">{value}</td>
                            <td className="text-slate-500">{meaning}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    ['MRV', stats?.mrv_heuristic_enabled],
                    ['LCV', stats?.lcv_enabled],
                    ['Forward checking', stats?.forward_checking_enabled],
                    ['AC-3', stats?.ac3_enabled]
                  ].map(([label, enabled]) => (
                    <span key={label} className={enabled ? 'badge-emerald' : 'badge-slate'}>
                      {label}: {enabled ? 'enabled' : 'disabled'}
                    </span>
                  ))}
                </div>
              </Section>

              {utility && (
                <Section
                  title="Schedule utility"
                  description="How the chosen schedule scored against the objective components."
                >
                  <div className="ai-table-container">
                    <table className="ai-table">
                      <thead>
                        <tr>
                          <th>Component</th>
                          <th className="num">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(utility)
                          .filter(([key, value]) => key !== 'explanation' && typeof value === 'number')
                          .map(([key, value]) => (
                            <tr key={key}>
                              <td className="text-slate-700">{key.replace(/_/g, ' ')}</td>
                              <td className="num font-mono">{value.toFixed(2)}</td>
                            </tr>
                          ))}
                        <tr className="row-selected">
                          <td className="font-semibold text-slate-900">Total score</td>
                          <td className="num font-mono font-bold">{utility.total_score?.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {utility.explanation && (
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                      {utility.explanation}
                    </p>
                  )}
                </Section>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section
                  title="Constraints enforced"
                  description="Constraint classes the solver applied to this problem."
                >
                  {(solution.constraints_enforced || []).length === 0 ? (
                    <StateBlock variant="empty" title="No constraint class reported" />
                  ) : (
                    <div className="ai-table-container">
                      <table className="ai-table">
                        <thead>
                          <tr>
                            <th>Constraint</th>
                            <th>Implementation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {solution.constraints_enforced.map((c) => (
                            <tr key={c.name}>
                              <td className="font-medium text-slate-800">{c.name}</td>
                              <td className="col-code">{c.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                <Section
                  title="Constraints violated during search"
                  description="Recorded when the solver tried a value and had to undo it."
                >
                  {violated.length === 0 ? (
                    <StateBlock
                      variant="empty"
                      title="No violation was recorded"
                      detail="Propagation removed every infeasible value before it was tried."
                    />
                  ) : (
                    <ul className="space-y-1.5">
                      {violated.map((line, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-2xs leading-relaxed text-amber-900"
                        >
                          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
            </>
          )}
        </>
      ) : !loading && !error ? (
        <Section title="Solver output">
          <StateBlock variant="empty" title="No solution was returned" />
        </Section>
      ) : null}

    </div>
  );
}
