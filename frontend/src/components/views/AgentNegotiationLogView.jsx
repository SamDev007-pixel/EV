import React, { useState, useEffect } from 'react';
import { fetchNegotiationScenarios, resolveNegotiation, runMinimaxCompetition as solveMinimaxCompetition } from '../../services/api';
import { PageHeader, StatTile, StateBlock } from '../common';
import {
  Scale,
  CheckCircle2,
  Zap,
  Play,
  Loader2,
  GitBranch,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  XCircle
} from 'lucide-react';

/** Formats a solver-reported number, or an em dash when the field is absent. */
function UTIL(value, digits = 2) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
    return '—';
  }
  return Number(value).toFixed(digits);
}

export default function AgentNegotiationLogView() {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState('SCENARIO_IMMEDIATE_VS_OVERLOAD');
  const [negotiationResult, setNegotiationResult] = useState(null);
  const [minimaxResult, setMinimaxResult] = useState(null);
  const [activeModelTab, setActiveModelTab] = useState('nash'); // 'nash' | 'minimax'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [scenariosLoaded, setScenariosLoaded] = useState(false);

  const loadScenarios = async () => {
    try {
      const data = await fetchNegotiationScenarios();
      const list = Array.isArray(data) ? data : [];
      setScenarios(list);
      setScenariosLoaded(true);
      // Preselect the first scenario the backend actually exposes.
      if (list.length > 0 && !list.some((sc) => sc.id === selectedScenario)) {
        setSelectedScenario(list[0].id);
      }
    } catch (err) {
      console.warn('Failed to fetch negotiation scenarios:', err.message);
      setScenarios([]);
      setScenariosLoaded(true);
    }
  };

  const runNegotiation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await resolveNegotiation(selectedScenario);
      setNegotiationResult(res);
    } catch (err) {
      console.error('Failed to resolve negotiation', err);
      setError(err.message || 'Failed to resolve multi-agent game negotiation.');
    } finally {
      setLoading(false);
    }
  };

  const runMinimaxCompetition = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await solveMinimaxCompetition(2);
      setMinimaxResult(data);
    } catch (err) {
      console.error('Minimax solver error', err);
      setError(err.message || 'Failed to solve Minimax game tree with Alpha-Beta pruning.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenarios();
    runNegotiation();
  }, [selectedScenario]);

  const chosenAction = negotiationResult?.chosen_action;
  const matrix = negotiationResult?.evaluations_matrix || [];
  // The Nash product of the winning alternative is taken from its own matrix row, which is
  // where the solver reports it (the chosen-action object itself does not repeat it).
  const chosenRow = matrix.find((row) => row.alternative_id === chosenAction?.id);
  const chosenActionNashProduct = chosenRow?.nash_bargaining_product;
  // The solver ranks by Nash product first and falls back to social welfare whenever every
  // product is zero (which happens when an agent sits below its disagreement point). The
  // banner states which criterion actually decided this run instead of assuming one.
  const bestNashProduct = matrix.reduce(
    (max, row) => Math.max(max, Number(row.nash_bargaining_product) || 0),
    0
  );
  const decidedBy = bestNashProduct > 0 ? 'Nash bargaining product' : 'Social welfare, after the hard-constraint filter';

  return (
    <div className="page">
      
      {/* Top Banner: Context */}
      <PageHeader
        eyebrow="Pipeline · stage 8"
        title="Conflict resolution and game decisions"
        description="When two vehicles compete for the same bay or slot, the disputed resource is arbitrated either cooperatively (Nash bargaining over the utility frontier) or adversarially (Minimax with alpha-beta pruning)."
        actions={
          <div className="tabs" role="tablist" aria-label="Decision model">
            <button
              type="button"
              role="tab"
              aria-selected={activeModelTab === 'nash'}
              onClick={() => {
                setActiveModelTab('nash');
                runNegotiation();
              }}
              className="tab"
            >
              Nash bargaining
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeModelTab === 'minimax'}
              onClick={() => {
                setActiveModelTab('minimax');
                runMinimaxCompetition();
              }}
              className="tab"
            >
              Minimax / alpha-beta
            </button>
          </div>
        }
      />

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Game Decision Error:</strong> {error}</span>
          </div>
          <button
            onClick={() => activeModelTab === 'nash' ? runNegotiation() : runMinimaxCompetition()}
            className="btn-secondary text-xs px-2.5 py-1 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* MODEL 1: COOPERATIVE NASH BARGAINING */}
      {activeModelTab === 'nash' && (
        <div className="space-y-6">
          
          {/* Scenario Selector */}
          <div className="ai-card section space-y-4">
            <div className="section-head">
              <div>
                <h3 className="section-title">Contention scenarios</h3>
                <p className="section-desc">
                  Scenario definitions supplied by the backend game module.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {scenarios.map((sc) => {
                const isSelected = selectedScenario === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => setSelectedScenario(sc.id)}
                    className={`p-3.5 text-left rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/60 border-blue-500 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <h4 className="text-xs font-bold text-slate-900">{sc.name}</h4>
                    <p className="text-2xs text-slate-500 leading-relaxed line-clamp-2">{sc.description}</p>
                  </button>
                );
              })}

              {scenariosLoaded && scenarios.length === 0 && (
                <div className="sm:col-span-3">
                  <StateBlock
                    variant="error"
                    title="No contention scenario could be loaded"
                    detail="The game-decision service did not return any scenario definition."
                    action={
                      <button type="button" onClick={loadScenarios} className="btn-secondary btn-sm">
                        Retry
                      </button>
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* Selected Action Resolution Banner */}
          {chosenAction && (
            <div className="ai-card section border-blue-200 bg-blue-50/30">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-blue">Selected by {decidedBy}</span>
                    {chosenRow?.is_pareto_efficient && (
                      <span className="badge-emerald">Pareto efficient</span>
                    )}
                    {chosenRow && !chosenRow.is_hard_constraint_satisfied && (
                      <span className="badge-rose">Hard constraint violated</span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {chosenAction.title} ({chosenAction.id})
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                    {negotiationResult?.explanation}
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg text-center shrink-0">
                  <span className="kv-term">Nash product N(a)</span>
                  <span className="text-xl font-bold text-blue-600 font-mono">
                    {UTIL(chosenActionNashProduct, 1)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payoff Evaluation Matrix Table */}
          <div className="ai-card section space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Action Payoff &amp; Multi-Agent Utility Matrix
              </h3>
              <p className="text-xs text-slate-500">
                Each action scored against every agent's disagreement point (the payoff below which that agent rejects the deal).
              </p>
            </div>

            <div className="ai-table-container">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Alternative</th>
                    <th className="num">EV agent</th>
                    <th className="num">Grid agent</th>
                    <th className="num">Station agent</th>
                    <th className="num">Energy agent</th>
                    <th className="num">Social welfare</th>
                    <th className="num">Nash product</th>
                    <th className="col-center">Hard constraints</th>
                    <th className="col-center">Pareto optimal</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => {
                    const isChosen = chosenAction && row.alternative_id === chosenAction.id;

                    return (
                      <tr key={i} className={isChosen ? 'row-selected font-semibold' : ''}>
                        <td className="font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{row.alternative_title || row.alternative_id}</span>
                            {isChosen && <span className="badge-blue text-2xs">CHOSEN</span>}
                          </div>
                        </td>
                        <td className="num font-mono">{UTIL(row.utilities?.EV_AGENT)}</td>
                        <td className="num font-mono">{UTIL(row.utilities?.GRID_AGENT)}</td>
                        <td className="num font-mono">{UTIL(row.utilities?.STATION_AGENT)}</td>
                        <td className="num font-mono">{UTIL(row.utilities?.ENERGY_AGENT)}</td>
                        <td className="num font-mono font-bold">{UTIL(row.social_welfare_score)}</td>
                        <td className="num font-mono font-bold text-blue-700">{UTIL(row.nash_bargaining_product, 1)}</td>
                        <td className="col-center">
                          {row.is_hard_constraint_satisfied ? (
                            <span className="badge-emerald">Satisfied</span>
                          ) : (
                            <span className="badge-rose">Violated</span>
                          )}
                        </td>
                        <td className="col-center">
                          {row.is_pareto_efficient ? (
                            <span className="badge-emerald">Pareto</span>
                          ) : (
                            <span className="badge-slate">Dominated</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {matrix.some((row) => row.rejection_reason) && (
              <div className="space-y-2">
                <span className="kv-term">Why the rejected alternatives were set aside</span>
                <ul className="space-y-1.5">
                  {matrix
                    .filter((row) => row.rejection_reason)
                    .map((row) => (
                      <li
                        key={row.alternative_id}
                        className="flex items-start gap-2 rounded-md border border-slate-200 p-2.5 text-2xs leading-relaxed text-slate-600"
                      >
                        <XCircle className="mt-px h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span>
                          <strong className="text-slate-800">{row.alternative_id}</strong>{' '}
                          {row.rejection_reason}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODEL 2: MINIMAX & ALPHA-BETA PRUNING */}
      {activeModelTab === 'minimax' && (
        <div className="space-y-6">
          <div className="ai-card section space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-blue-600" />
                  <span>Two-Player Zero-Sum Slot Competition (Minimax with Alpha-Beta)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  EV1 (MAX) and EV2 (MIN) contend for an ultra-fast charging bay. Alpha-Beta pruning cuts provably worse branches.
                </p>
              </div>

              <button
                onClick={runMinimaxCompetition}
                disabled={loading}
                className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Re-Solve Minimax Tree</span>
              </button>
            </div>

            {/* Tree Summary Stats */}
            {(() => {
              const mRes = minimaxResult?.result || minimaxResult;
              const mMetrics = minimaxResult?.metrics || {};
              // Values are read from the solver response. Nothing is substituted when a
              // field is absent - the tile simply reports "n/a".
              const alphaCutoffs = mMetrics.alpha_cutoffs ?? mRes?.alpha_cutoffs;
              const betaCutoffs = mMetrics.beta_cutoffs ?? mRes?.beta_cutoffs;
              const prunedCutoffs =
                alphaCutoffs === undefined && betaCutoffs === undefined
                  ? null
                  : (alphaCutoffs ?? 0) + (betaCutoffs ?? 0);
              const evaluatedNodes = mMetrics.nodes_evaluated ?? mRes?.nodes_evaluated;
              const minimaxUtil = mMetrics.minimax_utility ?? mRes?.minimax_utility;
              const bestAction = mRes?.ev1_optimal_action?.action_id || mRes?.best_action;
              const explanationText = minimaxResult?.explanation || mRes?.explanation;

              return (
                <>
                  <div className="stat-grid">
                    <StatTile
                      label="Pruned branches"
                      value={prunedCutoffs}
                      tone="success"
                      hint="Subtrees cut by alpha-beta without changing the result"
                    />
                    <StatTile label="Nodes evaluated" value={evaluatedNodes} hint="Game-tree nodes actually expanded" />
                    <StatTile
                      label="Optimal value V*"
                      value={
                        typeof minimaxUtil === 'number'
                          ? `${minimaxUtil >= 0 ? '+' : ''}${minimaxUtil.toFixed(2)}`
                          : minimaxUtil
                      }
                      tone="primary"
                      hint="Guaranteed utility against best opposition"
                    />
                    <StatTile label="Chosen action" value={bestAction} size="sm" />
                  </div>

                  {/* Decision Rationale */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
                    <strong className="mb-1 block text-slate-900">Solver rationale</strong>
                    {explanationText || 'The solver did not return an explanation string for this run.'}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
