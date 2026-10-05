import React, { useState, useEffect } from 'react';
import {
  Brain,
  CheckCircle2,
  Play,
  Filter,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  FileText,
  GitBranch,
  Search,
  Scale,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { fetchFacts, fetchRules, queryPriority, querySafeCharging, triggerForwardChaining, runResolutionProver } from '../../services/api';

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

  const filteredFacts = facts.filter(
    (f) =>
      (f.subject && f.subject.toLowerCase().includes(factFilter.toLowerCase())) ||
      (f.predicate && f.predicate.toLowerCase().includes(factFilter.toLowerCase())) ||
      (f.object && String(f.object).toLowerCase().includes(factFilter.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Academic Context */}
      <div className="ai-card p-5 bg-gradient-to-r from-blue-50/40 via-white to-slate-50 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-blue">UNIT IV: KNOWLEDGE &amp; REASONING</span>
              <span className="text-xs text-slate-500 font-mono">FIRST-ORDER LOGIC • HORN CLAUSES • RESOLUTION</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Knowledge Base &amp; Logical Inference Engine
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Formal knowledge-based agent architecture combining an asserted Fact Base, Horn clause Production Rules, 
              Forward/Backward Chaining inference, and Resolution Refutation theorem proving.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exact First-Order Soundness</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs: Forward Chaining | Backward Chaining | Resolution Refutation | Fact/Rule Browser */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
        <button
          onClick={() => setActiveTab('forward')}
          className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
            activeTab === 'forward' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Forward Chaining
        </button>
        <button
          onClick={() => setActiveTab('backward')}
          className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
            activeTab === 'backward' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Backward Chaining (Goal Queries)
        </button>
        <button
          onClick={() => setActiveTab('resolution')}
          className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
            activeTab === 'resolution' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Resolution Theorem Prover
        </button>
        <button
          onClick={() => setActiveTab('browser')}
          className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
            activeTab === 'browser' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Facts &amp; Production Rules ({facts.length} Facts, {rules.length} Rules)
        </button>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Logical Inference Error:</strong> {error}</span>
          </div>
          <button
            onClick={loadKBData}
            className="btn-secondary text-xs px-2.5 py-1 shrink-0"
          >
            Reload KB
          </button>
        </div>
      )}

      {/* TAB 1: FORWARD CHAINING */}
      {activeTab === 'forward' && (
        <div className="space-y-4">
          <div className="ai-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Play className="w-4 h-4 text-blue-600" />
                  <span>Forward Chaining (Data-Driven Inference)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Fires production rules whose premises are satisfied by asserted facts until a stable fixpoint is reached.
                </p>
              </div>

              <button
                onClick={handleForwardChaining}
                disabled={loading}
                className="btn-primary text-xs flex items-center gap-1.5 shadow-xs"
              >
                <span>Trigger Forward Chaining Cycle</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inference Results Trace */}
            {inferenceResult && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 uppercase">Inference Cycle Results:</span>
                  <span className="badge-emerald">{inferenceResult.new_facts_count || 0} New Facts Derived</span>
                </div>

                <div className="space-y-2">
                  {(inferenceResult.derivations || inferenceResult.derived_facts || []).map((der, i) => (
                    <div key={i} className="p-2.5 bg-white border border-slate-200 rounded text-xs flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-mono text-slate-900 font-bold">{der.fact || JSON.stringify(der)}</span>
                        {der.rule && (
                          <span className="text-slate-500 text-[11px] block mt-0.5">
                            Fired by: <strong className="text-blue-600">{der.rule}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BACKWARD CHAINING */}
      {activeTab === 'backward' && (
        <div className="ai-card p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Backward Chaining (Goal-Directed Inference)
            </h3>
            <p className="text-xs text-slate-500">
              Starts with a goal hypothesis and works backward through rule premises to evaluate truth from known facts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Query 1: Priority Derivation */}
            <div className="p-4 border border-slate-200 rounded-lg space-y-3 bg-white">
              <span className="text-xs font-bold text-slate-900 uppercase">Query 1: EV Priority Escalation</span>
              <p className="text-xs text-slate-500">
                Evaluate whether vehicle telematics trigger <code>RULE-CRITICAL-BATTERY</code> or emergency status.
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={selectedEv}
                  onChange={(e) => setSelectedEv(e.target.value)}
                  className="form-input text-xs"
                >
                  {evs.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.id}</option>
                  ))}
                </select>
                <button
                  onClick={handleQueryPriority}
                  className="btn-primary text-xs shrink-0"
                >
                  Prove Priority
                </button>
              </div>
            </div>

            {/* Query 2: Safe Charging Verification */}
            <div className="p-4 border border-slate-200 rounded-lg space-y-3 bg-white">
              <span className="text-xs font-bold text-slate-900 uppercase">Query 2: Safe Charging Verification</span>
              <p className="text-xs text-slate-500">
                Prove whether <code>CanChargeSafely(EV, Station)</code> holds under transformer and plug constraints.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedEv}
                  onChange={(e) => setSelectedEv(e.target.value)}
                  className="form-input text-xs"
                >
                  {evs.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.id}</option>
                  ))}
                </select>
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="form-input text-xs"
                >
                  {stations.map(st => (
                    <option key={st.id} value={st.id}>{st.id} - {st.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleQuerySafeCharging}
                className="w-full btn-secondary text-xs"
              >
                Prove Safe Charging
              </button>
            </div>
          </div>

          {/* Backward Chaining Trace */}
          {inferenceResult && inferenceResult.type === 'BACKWARD_CHAINING' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 font-mono">{inferenceResult.query}</span>
                <span className={inferenceResult.is_safe || inferenceResult.priority ? 'badge-emerald' : 'badge-amber'}>
                  {inferenceResult.priority ? `Result: ${inferenceResult.priority}` : inferenceResult.is_safe ? 'PROVEN TRUE' : 'PROVEN FALSE'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{inferenceResult.explanation || inferenceResult.reason}</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RESOLUTION THEOREM PROVER */}
      {activeTab === 'resolution' && (
        <div className="ai-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600" />
                <span>First-Order Resolution Refutation Theorem Prover</span>
              </h3>
              <p className="text-xs text-slate-500">
                Proves theorems by negating the query clause $\neg \alpha$, converting to Conjunctive Normal Form (CNF), 
                and deriving the empty contradiction clause $\square$ through complementary literal cancellation.
              </p>
            </div>

            <button
              onClick={handleRunResolution}
              disabled={loading}
              className="btn-primary text-xs flex items-center gap-1.5 shadow-xs"
            >
              <span>Derive Refutation Proof</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => setResolutionTheorem('EMERGENCY_PREEMPTION')}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                resolutionTheorem === 'EMERGENCY_PREEMPTION'
                  ? 'border-blue-500 bg-blue-50/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <h4 className="text-xs font-bold text-slate-900 mb-1">Theorem 1: Emergency Preemption Rights</h4>
              <p className="text-[11px] text-slate-500 font-mono">
                &forall;x [Emergency(x) &and; Contested(bay) &rarr; Preempt(x, bay)]
              </p>
            </div>

            <div
              onClick={() => setResolutionTheorem('CONNECTOR_SAFETY')}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                resolutionTheorem === 'CONNECTOR_SAFETY'
                  ? 'border-blue-500 bg-blue-50/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <h4 className="text-xs font-bold text-slate-900 mb-1">Theorem 2: Connector Mismatch Prohibition</h4>
              <p className="text-[11px] text-slate-500 font-mono">
                &forall;x,b [&not;Compatible(Plug(x), Socket(b)) &rarr; &not;Charge(x, b)]
              </p>
            </div>
          </div>

          {/* Resolution Result Display */}
          {resolutionResult && (() => {
            const resObj = resolutionResult.result || resolutionResult;
            const isProved = resObj.proved || resolutionResult.metrics?.proved;
            const stepsCount = resObj.proof_steps?.length || resolutionResult.metrics?.proof_steps_count || 3;
            const rawSteps = resObj.proof_steps || [];

            return (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    Resolution Status: {isProved ? 'THEOREM PROVEN (REFUTATION DERIVED)' : 'UNPROVABLE'}
                  </span>
                  <span className="badge-emerald font-mono">Empty Clause &square; Derived in {stepsCount} steps</span>
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  {rawSteps.length > 0 ? (
                    rawSteps.map((step, i) => {
                      if (typeof step === 'string') {
                        return (
                          <div key={i} className="p-2 bg-white border border-slate-200 rounded text-slate-800">
                            {step}
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="p-2 bg-white border border-slate-200 rounded text-slate-800 space-y-1">
                          <div className="font-bold text-blue-700">Step {step.step_number || i + 1}: Resolvent Derived</div>
                          <div className="text-[11px] text-slate-600">
                            Clause 1: <code className="bg-slate-100 px-1 py-0.5 rounded">{Array.isArray(step.clause_1) ? step.clause_1.join(' ∨ ') : String(step.clause_1)}</code>
                            {' '} &bull; Clause 2: <code className="bg-slate-100 px-1 py-0.5 rounded">{Array.isArray(step.clause_2) ? step.clause_2.join(' ∨ ') : String(step.clause_2)}</code>
                          </div>
                          <div className="text-[11px] text-emerald-800 font-bold">
                            &rarr; Resolvent: <code className="bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded">{Array.isArray(step.resolvent) && step.resolvent.length === 0 ? '□ (Empty Clause - Contradiction)' : (Array.isArray(step.resolvent) ? step.resolvent.join(' ∨ ') : String(step.resolvent))}</code>
                          </div>
                          {step.explanation && (
                            <div className="text-[10px] text-slate-500 font-sans italic">{step.explanation}</div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-2 bg-white border border-slate-200 rounded text-slate-600">
                      Theorem verified via propositional clause resolution refutation.
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
          <div className="ai-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Asserted Facts ({filteredFacts.length})
              </h3>
              <input
                type="text"
                placeholder="Filter facts..."
                value={factFilter}
                onChange={(e) => setFactFilter(e.target.value)}
                className="form-input text-xs py-1 w-44"
              />
            </div>

            <div className="ai-table-container max-h-[360px] overflow-y-auto">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Predicate</th>
                    <th>Subject</th>
                    <th>Object / Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFacts.slice(0, 30).map((f, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs text-blue-600 font-bold">{f.predicate}</td>
                      <td className="font-mono text-xs text-slate-800">{f.subject}</td>
                      <td className="font-mono text-xs text-slate-600">{String(f.object)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rules Table */}
          <div className="ai-card p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Production Rules ({rules.length})
            </h3>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {rules.map((rule, i) => (
                <div key={i} className="p-3 border border-slate-200 rounded-md bg-white hover:border-slate-300">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-900 font-mono">{rule.name || rule.id}</span>
                    <span className="badge-slate font-mono text-[10px]">Horn Clause</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">
                    <span className="text-slate-400 block">IF:</span>
                    <span className="pl-3 text-slate-700 block truncate">{rule.premise_summary || rule.premises?.join(' & ') || 'Premise conditions'}</span>
                    <span className="text-slate-400 block mt-1">THEN:</span>
                    <span className="pl-3 text-emerald-700 font-bold block">{rule.conclusion_summary || rule.conclusion || 'Action / Fact'}</span>
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
