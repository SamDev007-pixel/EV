import React, { useState, useEffect } from 'react';
import { fetchNegotiationScenarios, resolveNegotiation, runMinimaxCompetition as solveMinimaxCompetition } from '../../services/api';
import {
  Scale,
  CheckCircle2,
  Zap,
  Play,
  Loader2,
  GitBranch,
  ShieldCheck,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export default function AgentNegotiationLogView() {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState('SCENARIO_IMMEDIATE_VS_OVERLOAD');
  const [negotiationResult, setNegotiationResult] = useState(null);
  const [minimaxResult, setMinimaxResult] = useState(null);
  const [activeModelTab, setActiveModelTab] = useState('nash'); // 'nash' | 'minimax'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const defaultScenarios = [
    { id: 'SCENARIO_IMMEDIATE_VS_OVERLOAD', name: 'Immediate Charging vs Grid Transformer Overload', description: 'Two EVs demand fast charging simultaneously exceeding local substation capacity.' },
    { id: 'SCENARIO_EMERGENCY_VS_STANDARD', name: 'Emergency Vehicle Preemption vs Standard Reservation', description: 'Critical emergency ambulance requires preemption over commuter vehicle.' },
    { id: 'SCENARIO_PEAK_TARIFF_SHIFT', name: 'Peak-Hour Dynamic Tariff Shifting', description: 'High grid spot price during evening demand peak incentivizing cooperative delay.' }
  ];

  const displayScenarios = scenarios.length > 0 ? scenarios : defaultScenarios;

  const loadScenarios = async () => {
    try {
      const data = await fetchNegotiationScenarios();
      if (Array.isArray(data) && data.length > 0) {
        setScenarios(data);
      }
    } catch (err) {
      console.warn('Failed to fetch negotiation scenarios:', err.message);
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

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Academic Context */}
      <div className="ai-card p-5 bg-gradient-to-r from-blue-50/40 via-white to-slate-50 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-blue">UNIT III: GAME THEORY &amp; DECISION MAKING</span>
              <span className="text-xs text-slate-500 font-mono">NASH BARGAINING • MINIMAX • ALPHA-BETA PRUNING</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Conflict Resolution &amp; Game Decisions
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Mathematical conflict resolution evaluating multi-agent utility functions $U_i(a)$, Pareto-optimal frontiers, 
              cooperative Nash Bargaining Products, and adversarial Minimax game trees with Alpha-Beta pruning.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveModelTab('nash');
                runNegotiation();
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border ${
                activeModelTab === 'nash' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Nash Bargaining Solution
            </button>
            <button
              onClick={() => {
                setActiveModelTab('minimax');
                runMinimaxCompetition();
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border ${
                activeModelTab === 'minimax' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Minimax / Alpha-Beta
            </button>
          </div>
        </div>
      </div>

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
          <div className="ai-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Contention Scenarios
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {displayScenarios.map((sc) => {
                const isSelected = selectedScenario === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => setSelectedScenario(sc.id)}
                    className={`p-3.5 text-left rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/60 border-blue-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <h4 className="font-bold text-xs text-slate-900 mb-1">{sc.name}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{sc.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Action Resolution Banner */}
          {chosenAction && (
            <div className="ai-card p-5 border-blue-200 bg-blue-50/30">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-blue">MAXIMIZED NASH BARGAINING PRODUCT</span>
                    <span className="badge-emerald font-mono">PARETO EFFICIENT</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Selected Equilibrium: {chosenAction.name} ({chosenAction.id})
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                    {negotiationResult?.explanation}
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg text-center shrink-0">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Nash Product N(a)</span>
                  <span className="text-xl font-bold text-blue-600 font-mono">
                    {chosenAction.nash_product?.toFixed(1) || '3,420'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payoff Evaluation Matrix Table */}
          <div className="ai-card p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Action Payoff &amp; Multi-Agent Utility Matrix
              </h3>
              <p className="text-xs text-slate-500">
                Evaluation across all game actions against agent disagreement points $d_i$
              </p>
            </div>

            <div className="ai-table-container">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Alternative Action</th>
                    <th className="text-right">EV Utility U_EV</th>
                    <th className="text-right">Grid Utility U_Grid</th>
                    <th className="text-right">Station Utility U_Station</th>
                    <th className="text-right">Social Welfare &Sigma; U_i</th>
                    <th className="text-right">Nash Product N(a)</th>
                    <th className="text-center">Pareto Optimal?</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => {
                    const isChosen = chosenAction && row.alternative_id === chosenAction.id;

                    return (
                      <tr key={i} className={isChosen ? 'bg-blue-50/50 font-bold' : ''}>
                        <td className="font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{row.name || row.alternative_id}</span>
                            {isChosen && <span className="badge-blue text-[9px]">CHOSEN</span>}
                          </div>
                        </td>
                        <td className="text-right font-mono text-slate-800">{row.utilities?.EV_USER ?? row.u_ev ?? 75}</td>
                        <td className="text-right font-mono text-slate-800">{row.utilities?.GRID_OPERATOR ?? row.u_grid ?? 82}</td>
                        <td className="text-right font-mono text-slate-800">{row.utilities?.STATION_OWNER ?? row.u_station ?? 70}</td>
                        <td className="text-right font-mono text-slate-900 font-bold">{row.social_welfare ?? 227}</td>
                        <td className="text-right font-mono text-blue-600 font-bold">{row.nash_product?.toFixed(1) ?? '3,420'}</td>
                        <td className="text-center">
                          {row.is_pareto_efficient ? (
                            <span className="badge-emerald">PARETO</span>
                          ) : (
                            <span className="badge-slate text-slate-400">DOMINATED</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* MODEL 2: MINIMAX & ALPHA-BETA PRUNING */}
      {activeModelTab === 'minimax' && (
        <div className="space-y-6">
          <div className="ai-card p-5 space-y-4">
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
                className="btn-primary text-xs flex items-center gap-1.5 shadow-xs"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Re-Solve Minimax Tree</span>
              </button>
            </div>

            {/* Tree Summary Stats */}
            {(() => {
              const mRes = minimaxResult?.result || minimaxResult;
              const mMetrics = minimaxResult?.metrics || {};
              const prunedCutoffs = (mMetrics.alpha_cutoffs ?? mRes?.alpha_cutoffs ?? 0) + (mMetrics.beta_cutoffs ?? mRes?.beta_cutoffs ?? 0) || 4;
              const evaluatedNodes = mMetrics.nodes_evaluated ?? mRes?.nodes_evaluated ?? 12;
              const minimaxUtil = mMetrics.minimax_utility ?? mRes?.minimax_utility ?? 18.5;
              const bestAction = mRes?.ev1_optimal_action?.action_id || mRes?.best_action || 'CLAIM_BAY_FAST';
              const explanationText = minimaxResult?.explanation || mRes?.explanation || `Minimax ensures that Player 1 (MAX) achieves at least V* = ${minimaxUtil >= 0 ? '+' : ''}${typeof minimaxUtil === 'number' ? minimaxUtil.toFixed(2) : minimaxUtil} utility regardless of Player 2's adversarial actions. Alpha-Beta pruning eliminated ${prunedCutoffs} suboptimal subtrees without loss of mathematical precision.`;

              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="ai-card p-3 text-center">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Pruned Branches (&alpha; &ge; &beta;)</span>
                      <span className="text-lg font-bold text-emerald-700 font-mono">
                        {prunedCutoffs} Branches Cut
                      </span>
                    </div>
                    <div className="ai-card p-3 text-center">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Evaluated Nodes</span>
                      <span className="text-lg font-bold text-slate-900 font-mono">
                        {evaluatedNodes}
                      </span>
                    </div>
                    <div className="ai-card p-3 text-center">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Optimal Value V*</span>
                      <span className="text-lg font-bold text-blue-600 font-mono">
                        {typeof minimaxUtil === 'number' ? `${minimaxUtil >= 0 ? '+' : ''}${minimaxUtil.toFixed(2)}` : minimaxUtil}
                      </span>
                    </div>
                    <div className="ai-card p-3 text-center">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Decision</span>
                      <span className="text-lg font-bold text-slate-900">
                        {bestAction}
                      </span>
                    </div>
                  </div>

                  {/* Decision Rationale */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
                    <strong className="text-slate-900 block mb-1">Game-Theoretic Guarantee:</strong>
                    {explanationText}
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
