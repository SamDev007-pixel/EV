import React, { useState, useEffect } from 'react';
import { Play, ArrowRight, Loader2 } from 'lucide-react';
import { fetchFacts, fetchRules, queryPriority, querySafeCharging, triggerForwardChaining, runResolutionProver } from '../../services/api';
import { PageHeader, Banner, KeyValueGrid } from '../common';

export default function LogicReasoningView({ evs = [], stations = [] }) {
  const [facts, setFacts] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedEv, setSelectedEv] = useState(evs[0]?.id || 'EV-07');
  const [selectedStation, setSelectedStation] = useState(stations[0]?.id || 'CS-02');
  const [factFilter, setFactFilter] = useState('');
  const [activeTab, setActiveTab] = useState('forward');
  const [inferenceResult, setInferenceResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Resolution Theorem Prover state
  const [resolutionTheorem, setResolutionTheorem] = useState('EMERGENCY_PREEMPTION');
  const [resolutionResult, setResolutionResult] = useState(null);

  const loadKBData = async () => {
    try {
      const [fData, rData] = await Promise.all([fetchFacts(), fetchRules()]);
      setFacts(Array.isArray(fData) ? fData : []);
      setRules(Array.isArray(rData) ? rData : []);
    } catch (err) {
      console.warn('Failed to load KB data:', err.message);
    }
  };

  useEffect(() => {
    loadKBData();
    // The forward-chaining trace is the first thing this screen shows, so the inference cycle is
    // executed once on mount from the live rule base; the button re-runs it on demand.
    handleForwardChaining();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleForwardChaining = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await triggerForwardChaining();
      setInferenceResult(data);
      await loadKBData();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Forward chaining inference failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQueryPriority = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await queryPriority(selectedEv);
      setInferenceResult({
        type: 'BACKWARD_CHAINING',
        query: `DerivePriority(${selectedEv})`,
        ...data
      });
    } catch (err) {
      console.error(err);
      setError(err.message || `Priority query for ${selectedEv} failed.`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuerySafeCharging = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await querySafeCharging(selectedEv, selectedStation);
      setInferenceResult({
        type: 'BACKWARD_CHAINING',
        query: `CanChargeSafely(${selectedEv}, ${selectedStation})`,
        ...data
      });
    } catch (err) {
      console.error(err);
      setError(err.message || `Safe charging query for ${selectedEv} at ${selectedStation} failed.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunResolution = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runResolutionProver(resolutionTheorem);
      setResolutionResult(data);
    } catch (err) {
      console.error('Resolution proof error', err);
      setError(err.message || 'Resolution refutation theorem prover failed.');
    } finally {
      setLoading(false);
    }
  };

  // Backward chaining reports the goal value in `result` and whether the goal was proved in
  // `is_success`. Both are read here so the badge never contradicts the payload.
  const backwardProved =
    inferenceResult?.is_success === true ||
    inferenceResult?.is_safe === true ||
    typeof inferenceResult?.result === 'boolean';
  const backwardValueText =
    inferenceResult?.result === null || inferenceResult?.result === undefined
      ? 'no value derived from the current facts'
      : typeof inferenceResult?.result === 'boolean'
        ? inferenceResult.result
          ? 'true'
          : 'false'
        : String(inferenceResult.result);

  const filteredFacts = facts.filter(
    (f) =>
      (f.subject && f.subject.toLowerCase().includes(factFilter.toLowerCase())) ||
      (f.predicate && f.predicate.toLowerCase().includes(factFilter.toLowerCase())) ||
      (f.value !== undefined && String(f.value).toLowerCase().includes(factFilter.toLowerCase()))
  );

  return (
    <div className="page">
      
      <PageHeader
        eyebrow="Knowledge & Logic Rules"
        title="Knowledge Base & Logical Inference"
        description="Verify charging eligibility, safety constraints, and priority rules using forward chaining, backward goal verification, and resolution refutation."
        actions={<span className="badge-slate">Active Rule Verification Engine</span>}
      />

      {/* Tabs: forward chaining | backward chaining | resolution | fact and rule browser */}
      <div className="tabs" role="tablist" aria-label="Inference method">
        {[
          ['forward', 'Forward chaining'],
          ['backward', 'Backward chaining'],
          ['resolution', 'Resolution refutation'],
          ['browser', `Facts and rules (${facts.length}/${rules.length})`]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className="tab"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error Alert Banner */}
      {error && (
        <Banner
          variant="error"
          action={
            <button type="button" onClick={loadKBData} className="btn-secondary btn-sm shrink-0">
              Reload knowledge base
            </button>
          }
        >
          <strong>Logical inference error.</strong> {error}
        </Banner>
      )}

      {/* TAB 1: FORWARD CHAINING */}
      {activeTab === 'forward' && (
        <div className="space-y-4">
          <div className="ai-card section space-y-4">
            <div className="section-head">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                  <Play className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="section-title">Forward chaining (data-driven inference)</h3>
                  <p className="section-desc">
                    Fires production rules whose premises are satisfied by asserted facts until a stable
                    fixpoint is reached.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleForwardChaining}
                disabled={loading}
                className="btn-primary btn-sm shrink-0"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run forward chaining
              </button>
            </div>

            {/* Inference Results Trace */}
            {inferenceResult && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="kv-term">Inference cycle result</span>
                  <span className="badge-emerald">
                    {(inferenceResult.derived_facts || []).length} facts derived
                    {(inferenceResult.rules_applied || []).length > 0
                      ? ` · ${inferenceResult.rules_applied.length} rules fired`
                      : ''}
                  </span>
                </div>

                {typeof inferenceResult.result === 'string' && (
                  <p className="text-xs leading-relaxed text-slate-600">{inferenceResult.result}</p>
                )}

                <div className="ai-table-container max-h-[360px] overflow-y-auto">
                  <table className="ai-table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Derived predicate</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inferenceResult.derived_facts || []).slice(0, 40).map((fact, i) => (
                        <tr key={`${fact.subject}-${fact.predicate}-${i}`}>
                          <td className="col-code">{fact.subject}</td>
                          <td className="col-code">{fact.predicate}</td>
                          <td className="font-medium text-slate-800">{String(fact.value)}</td>
                        </tr>
                      ))}
                      {(inferenceResult.derived_facts || []).length === 0 && (
                        <tr>
                          <td colSpan="3" className="text-center text-slate-500">
                            No new fact was derived by this cycle.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {(inferenceResult.rules_applied || []).length > 0 && (
                  <div className="space-y-2">
                    <span className="kv-term">Rules fired in order</span>
                    <ul className="flex flex-wrap gap-2">
                      {inferenceResult.rules_applied.map((ruleId) => (
                        <li key={typeof ruleId === 'string' ? ruleId : ruleId.id} className="badge-blue font-mono">
                          {typeof ruleId === 'string' ? ruleId : ruleId.id || ruleId.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BACKWARD CHAINING */}
      {activeTab === 'backward' && (
        <div className="ai-card section space-y-4">
          <div className="section-head">
            <div className="min-w-0">
              <h3 className="section-title">Backward chaining (goal-directed inference)</h3>
              <p className="section-desc">
                Starts with a goal hypothesis and works backward through rule premises to evaluate truth
                from known facts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Query 1: Priority Derivation */}
            <div className="ai-card-flat space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-900">Query 1 · vehicle priority</h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  Prove the charging priority the rule base infers for one vehicle.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="form-label" htmlFor="logic-priority-ev">Vehicle</label>
                <div className="flex items-center gap-2">
                  <select
                    id="logic-priority-ev"
                    value={selectedEv}
                    onChange={(e) => setSelectedEv(e.target.value)}
                    className="form-input text-xs"
                  >
                    {evs.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.id}</option>
                    ))}
                  </select>
                  <button type="button" onClick={handleQueryPriority} disabled={loading} className="btn-primary btn-sm shrink-0">
                    Prove priority
                  </button>
                </div>
              </div>
            </div>

            {/* Query 2: Safe Charging Verification */}
            <div className="ai-card-flat space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-900">Query 2 · safe charging</h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  Prove whether this vehicle may charge at one station under the transformer and connector
                  constraints in the rule base.
                </p>
              </div>
              <div className="form-grid grid-cols-1 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="form-label" htmlFor="logic-safe-ev">Vehicle</label>
                  <select
                    id="logic-safe-ev"
                    value={selectedEv}
                    onChange={(e) => setSelectedEv(e.target.value)}
                    className="form-input text-xs"
                  >
                    {evs.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.id}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="form-label" htmlFor="logic-safe-station">Station</label>
                  <select
                    id="logic-safe-station"
                    value={selectedStation}
                    onChange={(e) => setSelectedStation(e.target.value)}
                    className="form-input text-xs"
                  >
                    {stations.map((st) => (
                      <option key={st.id} value={st.id}>{st.id} — {st.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="button" onClick={handleQuerySafeCharging} disabled={loading} className="btn-secondary btn-sm w-full">
                Prove safe charging
              </button>
            </div>
          </div>

          {/* Backward Chaining Trace */}
          {inferenceResult && inferenceResult.type === 'BACKWARD_CHAINING' && (
            <div className="ai-card-subtle space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="col-code">{inferenceResult.query}</span>
                <span className={backwardProved ? 'badge-emerald' : 'badge-amber'}>
                  {backwardProved ? 'Goal proved' : 'Not proved from the current facts'}
                </span>
              </div>
              <KeyValueGrid
                columns={2}
                items={[
                  { term: 'Goal value returned by the engine', value: backwardValueText, mono: true },
                  ...(inferenceResult.rules_applied?.length
                    ? [{ term: 'Rules applied', value: inferenceResult.rules_applied.join(', '), mono: true }]
                    : []),
                ]}
              />
              {inferenceResult.explanation_trace?.length > 0 && (
                <ol className="space-y-1">
                  {inferenceResult.explanation_trace.slice(0, 8).map((traceStep) => (
                    <li key={traceStep.step_number} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                      <span className="mt-0.5 shrink-0 font-mono text-2xs text-slate-400">
                        {String(traceStep.step_number).padStart(2, '0')}
                      </span>
                      <span>{traceStep.description}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RESOLUTION THEOREM PROVER */}
      {activeTab === 'resolution' && (
        <div className="ai-card section space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div className="min-w-0">
              <h3 className="section-title">Resolution refutation prover</h3>
              <p className="section-desc">
                The prover negates the query, resolves complementary literals in the clause set and reports
                whether the empty clause (a contradiction) can be derived.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunResolution}
              disabled={loading}
              className="btn-primary btn-sm shrink-0"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              Derive refutation proof
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => setResolutionTheorem('EMERGENCY_PREEMPTION')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setResolutionTheorem('EMERGENCY_PREEMPTION');
              }}
              className={`cursor-pointer rounded-md border p-3 transition-colors ${
                resolutionTheorem === 'EMERGENCY_PREEMPTION'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <h4 className="text-xs font-semibold text-slate-900">Theorem 1 · emergency preemption</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                An emergency vehicle that contests an occupied bay may preempt the bay. Query literal:{' '}
                <code className="col-code">THROTTLE</code>
              </p>
            </div>

            <div
              onClick={() => setResolutionTheorem('CONNECTOR_SAFETY')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setResolutionTheorem('CONNECTOR_SAFETY');
              }}
              className={`cursor-pointer rounded-md border p-3 transition-colors ${
                resolutionTheorem === 'CONNECTOR_SAFETY'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <h4 className="text-xs font-semibold text-slate-900">Theorem 2 · connector safety</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                A connector that does not match the socket must not be used to charge. Query literal:{' '}
                <code className="col-code">SAFE_CHARGE</code>
              </p>
            </div>
          </div>

          {/* Resolution Result Display */}
          {resolutionResult && (() => {
            const resObj = resolutionResult.result || resolutionResult;
            const isProved =
              resObj.proved ?? resolutionResult.metrics?.proved ?? null;
            const stepsCount =
              resObj.proof_steps?.length ?? resolutionResult.metrics?.proof_steps_count;
            const rawSteps = resObj.proof_steps || [];

            return (
              <div className="ai-card-subtle space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-xs font-semibold text-slate-900">
                    Resolution status:{' '}
                    {isProved === null
                      ? 'not reported'
                      : isProved
                        ? 'theorem proved by refutation'
                        : 'no refutation could be derived'}
                  </span>
                  <span className={isProved ? 'badge-emerald' : 'badge-slate'}>
                    {stepsCount === undefined
                      ? 'Step count not reported'
                      : `Empty clause derived in ${stepsCount} step(s)`}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  {rawSteps.length > 0 ? (
                    rawSteps.map((step, i) => {
                      if (typeof step === 'string') {
                        return (
                          <div key={i} className="ai-card-flat text-slate-800">
                            {step}
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="ai-card-flat space-y-1 text-slate-800">
                          <div className="text-xs font-semibold text-blue-700">
                            Step {step.step_number || i + 1} · resolvent derived
                          </div>
                          <div className="text-2xs text-slate-600">
                            Clause 1: <code className="bg-slate-100 px-1 py-0.5 rounded">{Array.isArray(step.clause_1) ? step.clause_1.join(' ∨ ') : String(step.clause_1)}</code>
                            {' '} &bull; Clause 2: <code className="bg-slate-100 px-1 py-0.5 rounded">{Array.isArray(step.clause_2) ? step.clause_2.join(' ∨ ') : String(step.clause_2)}</code>
                          </div>
                          <div className="text-2xs font-semibold text-emerald-800">
                            &rarr; Resolvent: <code className="bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded">{Array.isArray(step.resolvent) && step.resolvent.length === 0 ? '□ (Empty Clause - Contradiction)' : (Array.isArray(step.resolvent) ? step.resolvent.join(' ∨ ') : String(step.resolvent))}</code>
                          </div>
                          {step.explanation && (
                            <div className="text-2xs italic text-slate-500">{step.explanation}</div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="ai-card-flat text-slate-500">
                      The prover returned no resolvent steps for this query.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 4: FACTS & PRODUCTION RULES BROWSER */}
      {activeTab === 'browser' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Facts Table */}
          <div className="ai-card section space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title">
                Asserted facts
                <span className="ml-2 badge-slate font-mono">{filteredFacts.length}</span>
              </h3>
              <input
                type="search"
                aria-label="Filter facts"
                placeholder="Filter facts…"
                value={factFilter}
                onChange={(e) => setFactFilter(e.target.value)}
                className="form-input w-40 text-xs sm:w-56"
              />
            </div>

            <div className="ai-table-container max-h-[360px] overflow-y-auto">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Predicate</th>
                    <th>Subject</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFacts.slice(0, 30).map((f, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs font-bold text-blue-700">{f.predicate}</td>
                      <td className="font-mono text-xs text-slate-800">{f.subject}</td>
                      <td className="font-mono text-xs text-slate-600">{String(f.value)}</td>
                    </tr>
                  ))}
                  {filteredFacts.length === 0 && (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-slate-500">
                        No fact matches the filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rules Table */}
          <div className="ai-card section space-y-3">
            <h3 className="section-title">
              Production rules
              <span className="ml-2 badge-slate font-mono">{rules.length}</span>
            </h3>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {rules.map((rule, i) => (
                <div key={i} className="ai-card-flat transition-colors hover:border-slate-300">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="col-code font-semibold text-slate-900">{rule.name || rule.id}</span>
                    <span className="badge-slate font-mono">Horn clause</span>
                  </div>
                  <div className="text-2xs font-mono text-slate-600">
                    <span className="block text-slate-400">IF</span>
                    {(rule.conditions || []).length === 0 ? (
                      <span className="block pl-3 text-slate-400">no condition reported</span>
                    ) : (
                      rule.conditions.map((c, ci) => (
                        <span key={ci} className="block pl-3 text-slate-700">
                          {c.subject_param}.{c.predicate} {c.operator}{' '}
                          {String(c.target_value)}
                        </span>
                      ))
                    )}
                    <span className="mt-1 block text-slate-400">THEN</span>
                    <span className="block pl-3 font-bold text-emerald-700">
                      {rule.conclusion?.subject_param}.{rule.conclusion?.predicate}
                      {rule.conclusion?.value !== undefined
                        ? ` = ${String(rule.conclusion.value)}`
                        : rule.conclusion?.target_value !== undefined
                          ? ` = ${String(rule.conclusion.target_value)}`
                          : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
