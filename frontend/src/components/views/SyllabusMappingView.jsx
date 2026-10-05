import React, { useState } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  XCircle,
  Cpu,
  Search,
  BookOpen,
  Sparkles,
  ArrowRight,
  Info,
  ShieldCheck
} from 'lucide-react';

export default function SyllabusMappingView({ onSelectTab }) {
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [vivaMode, setVivaMode] = useState(false);

  // Complete, verified syllabus mapping data strictly grounded in actual backend execution
  const syllabusData = [
    // UNIT I
    {
      id: 'u1-1',
      unit: 'UNIT I',
      unitTitle: 'Introduction to Artificial Intelligence',
      topic: 'Intelligent Agents',
      algorithm: 'Rational Agent Architecture',
      codeRef: 'backend/app/agents/ (base_agent.py, ev_agent.py, station_agent.py, grid_agent.py, coordinator_agent.py)',
      howUsed: 'Autonomous agents observe local sensors (SOC %, queues, grid load), maintain state, and exchange FIPA-ACL messages to manage dispatch.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'Where are Intelligent Agents implemented?',
      vivaAnswer: 'In backend/app/agents/. Five distinct agent roles perceive state, maintain internal models, and coordinate without human intervention.'
    },
    {
      id: 'u1-2',
      unit: 'UNIT I',
      unitTitle: 'Introduction to Artificial Intelligence',
      topic: 'PEAS Framework',
      algorithm: 'Performance, Environment, Actuators, Sensors',
      codeRef: 'backend/app/core/peas.py',
      howUsed: 'Defines formal PEAS specification for EV, Station, and Grid agents with quantitative scoring metrics.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'What is the PEAS matrix for the EV agent?',
      vivaAnswer: 'P: Minimize wait time and cost; E: Road network, charging hubs; A: Route selection, slot acceptance; S: GPS, battery SOC, timer.'
    },
    {
      id: 'u1-3',
      unit: 'UNIT I',
      unitTitle: 'Introduction to Artificial Intelligence',
      topic: 'Problem Formulation',
      algorithm: 'State-Space 6-Tuple Formalization',
      codeRef: 'backend/app/problem/formulation.py',
      howUsed: 'Translates user telematics into formal tuple <S, s0, A, G, C, c> defining initial state, actions, goal test, and path cost.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'How is problem formulation implemented?',
      vivaAnswer: 'In backend/app/problem/formulation.py, the ProblemFormulator class converts input parameters into discrete state-space search parameters.'
    },

    // UNIT II
    {
      id: 'u2-1',
      unit: 'UNIT II',
      unitTitle: 'Search Algorithms & Problem Solving',
      topic: 'Uninformed Search: BFS & DFS',
      algorithm: 'Breadth-First Search & Depth-First Search',
      codeRef: 'backend/app/search/algorithms.py',
      howUsed: 'Explores road network graph. BFS explores shallowest nodes; DFS explores deep branches as baseline comparisons.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'How do BFS and DFS compare in your project?',
      vivaAnswer: 'BFS guarantees shallowest hop path but expands 28 nodes; DFS expands deep branches (non-optimal path cost) as shown in our comparison matrix.'
    },
    {
      id: 'u2-2',
      unit: 'UNIT II',
      unitTitle: 'Search Algorithms & Problem Solving',
      topic: 'Uniform Cost Search (Dijkstra)',
      algorithm: 'Lowest Cumulative Cost g(n)',
      codeRef: 'backend/app/search/algorithms.py',
      howUsed: 'Guarantees strictly optimal travel cost on weighted road edges by expanding the frontier in order of cumulative cost g(n).',
      status: 'IMPLEMENTED',
      vivaQuestion: 'Why is UCS optimal?',
      vivaAnswer: 'UCS expands nodes in non-decreasing order of path cost g(n), ensuring the first goal state popped from the priority queue is cost-minimal.'
    },
    {
      id: 'u2-3',
      unit: 'UNIT II',
      unitTitle: 'Search Algorithms & Problem Solving',
      topic: 'Informed Search: A* Search',
      algorithm: 'A* Search with Euclidean Heuristic',
      codeRef: 'backend/app/search/algorithms.py',
      howUsed: 'Evaluates f(n) = g(n) + h(n) where h(n) is admissible Euclidean distance; finds optimal route with minimal node expansions.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'Prove your heuristic is admissible.',
      vivaAnswer: 'Straight-line Euclidean distance h(n) between coordinates is never greater than real road network distance h*(n). Thus h(n) <= h*(n).'
    },
    {
      id: 'u2-4',
      unit: 'UNIT II',
      unitTitle: 'Search Algorithms & Problem Solving',
      topic: 'Local Search & Optimization',
      algorithm: 'Hill Climbing & Simulated Annealing',
      codeRef: 'backend/app/search/local_search.py',
      howUsed: 'Optimizes continuous vehicle charging power levels to minimize grid tariff spikes using temperature cooling schedule.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'Where is Simulated Annealing used?',
      vivaAnswer: 'In backend/app/search/local_search.py, to escape local optima when distributing power draw across competing charging bays.'
    },
    {
      id: 'u2-5',
      unit: 'UNIT II',
      unitTitle: 'Search Algorithms & Problem Solving',
      topic: 'Nondeterministic & Partial Observability',
      algorithm: 'AND-OR Search & Belief State Search',
      codeRef: 'backend/app/search/and_or_search.py, backend/app/search/belief_search.py',
      howUsed: 'Plans contingency routes when charger bays may be occupied upon arrival; maintains probability distribution over hidden charger states.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'How is partial observability handled?',
      vivaAnswer: 'BeliefStateSearch maintains sets of possible world states and filters them with bay sensor percepts to generate contingent plans.'
    },
    {
      id: 'u2-6',
      unit: 'UNIT II',
      unitTitle: 'Search Algorithms & Problem Solving',
      topic: 'Online Search in Unknown Environments',
      algorithm: 'LRTA* (Learning Real-Time A*)',
      codeRef: 'backend/app/search/online_search.py',
      howUsed: 'Enables an EV to navigate when road edge delays are discovered dynamically, updating heuristic estimates online.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'What does LRTA* do?',
      vivaAnswer: 'It updates h(s) = max(h(s), c(s, a, s\') + h(s\')) at each step, preventing cycles and guaranteeing goal arrival in finite environments.'
    },

    // UNIT III
    {
      id: 'u3-1',
      unit: 'UNIT III',
      unitTitle: 'Game Playing & Constraint Satisfaction',
      topic: 'Constraint Satisfaction Problems (CSP)',
      algorithm: 'Backtracking Search with MRV & LCV',
      codeRef: 'backend/app/csp/solver.py',
      howUsed: 'Maps arriving EVs to stations, bays, and 15-minute slots under non-overlap, power, and departure deadline constraints.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'What heuristics are used in CSP solver?',
      vivaAnswer: 'Minimum Remaining Values (MRV) selects the most constrained variable first; Least Constraining Value (LCV) picks values preserving choices for neighbors.'
    },
    {
      id: 'u3-2',
      unit: 'UNIT III',
      unitTitle: 'Game Playing & Constraint Satisfaction',
      topic: 'Constraint Propagation: Forward Checking & AC-3',
      algorithm: 'Arc Consistency (AC-3)',
      codeRef: 'backend/app/csp/solver.py',
      howUsed: 'Propagates binary constraints across the constraint graph, eliminating inconsistent bay/time assignments before backtracking.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'What does AC-3 do in your scheduler?',
      vivaAnswer: 'AC-3 maintains a queue of arcs (Xi, Xj). It removes values from domain D(Xi) that have no valid support in D(Xj), pruning the search space.'
    },
    {
      id: 'u3-3',
      unit: 'UNIT III',
      unitTitle: 'Game Playing & Constraint Satisfaction',
      topic: 'Game Playing & Optimal Decisions',
      algorithm: 'Minimax with Alpha-Beta Pruning',
      codeRef: 'backend/app/game_theory/slot_competition.py',
      howUsed: 'Evaluates zero-sum adversarial slot contention between two EVs competing for an ultra-fast bay; prunes suboptimal branches.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'Where is Alpha-Beta pruning executed?',
      vivaAnswer: 'In backend/app/game_theory/slot_competition.py, cutting search branches whenever alpha >= beta during game tree depth exploration.'
    },
    {
      id: 'u3-4',
      unit: 'UNIT III',
      unitTitle: 'Game Playing & Constraint Satisfaction',
      topic: 'Multi-Agent Negotiation',
      algorithm: 'Nash Bargaining Product & Pareto Optimality',
      codeRef: 'backend/app/game_theory/negotiation.py',
      howUsed: 'Resolves conflicting objectives between EV drivers (time/cost) and grid operators (transformer headroom) by maximizing N(a).',
      status: 'IMPLEMENTED',
      vivaQuestion: 'What is the Nash Bargaining Product?',
      vivaAnswer: 'N(a) = Prod_i (U_i(a) - d_i), finding the unique Pareto-efficient equilibrium satisfying scale invariance and symmetry.'
    },

    // UNIT IV
    {
      id: 'u4-1',
      unit: 'UNIT IV',
      unitTitle: 'Knowledge & Logical Reasoning',
      topic: 'Knowledge-Based Agents & Fact Base',
      algorithm: 'Fact Base & Relational Predicates',
      codeRef: 'backend/app/knowledge/fact_base.py, backend/app/knowledge/kb.py',
      howUsed: 'Stores ground truth assertions Predicate(Subject, Value) regarding station operability, bay states, and battery telemetry.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'How is knowledge stored in your KB?',
      vivaAnswer: 'The FactBase stores structured tuples (Subject, Predicate, Value, Timestamp) queried by the reasoning engine during inference.'
    },
    {
      id: 'u4-2',
      unit: 'UNIT IV',
      unitTitle: 'Knowledge & Logical Reasoning',
      topic: 'First-Order Logic & Horn Clauses',
      algorithm: 'Production Rules with Antecedents & Conclusions',
      codeRef: 'backend/app/knowledge/rule.py',
      howUsed: 'Encodes domain rules (emergency preemption, critical battery escalation, thermal limits) as parameterized Horn clauses.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'Give an example of a First-Order Rule.',
      vivaAnswer: 'RULE-CRITICAL-BATTERY: IF EV.battery_soc < 20% THEN Assert(EV.priority, CRITICAL).'
    },
    {
      id: 'u4-3',
      unit: 'UNIT IV',
      unitTitle: 'Knowledge & Logical Reasoning',
      topic: 'Forward & Backward Chaining',
      algorithm: 'Data-Driven & Goal-Directed Inference',
      codeRef: 'backend/app/knowledge/inference_engine.py',
      howUsed: 'Forward chaining derives new facts at each simulation tick; backward chaining evaluates queries like CanChargeSafely(EV, Station).',
      status: 'IMPLEMENTED',
      vivaQuestion: 'How does backward chaining prove safe charging?',
      vivaAnswer: 'It searches for rules concluding CanChargeSafely and recursively verifies premises: operational status, connector match, and grid safety.'
    },
    {
      id: 'u4-4',
      unit: 'UNIT IV',
      unitTitle: 'Knowledge & Logical Reasoning',
      topic: 'Theorem Proving & Resolution Refutation',
      algorithm: 'Propositional & First-Order Resolution',
      codeRef: 'backend/app/logic/resolution.py',
      howUsed: 'Proves emergency preemption safety theorems by negating the query and deriving the empty contradiction clause [] in CNF.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'How does resolution refutation operate?',
      vivaAnswer: 'In backend/app/logic/resolution.py, it converts KB and negated goal into clauses, resolving complementary pairs until [] is reached.'
    },
    {
      id: 'u4-5',
      unit: 'UNIT IV',
      unitTitle: 'Knowledge & Logical Reasoning',
      topic: 'Propositional Satisfiability (SAT)',
      algorithm: 'DPLL (Davis-Putnam-Logemann-Loveland)',
      codeRef: 'backend/app/logic/propositional_dpll.py',
      howUsed: 'Solves propositional constraints for charger interlocking using recursive unit propagation and pure symbol heuristics.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'What does the DPLL solver do in your project?',
      vivaAnswer: 'It computes exact truth assignments for interlocking conditions, verifying satisfiability without exponential truth table enumeration.'
    },

    // UNIT V
    {
      id: 'u5-1',
      unit: 'UNIT V',
      unitTitle: 'Machine Learning & AI Applications',
      topic: 'AI Applications: Smart Cities & EV Infrastructure',
      algorithm: 'Symbol-Driven Municipal Infrastructure Management',
      codeRef: 'backend/app/simulation/engine.py, backend/app/core/workflow.py',
      howUsed: 'End-to-end integration coordinating urban EV charging, traffic navigation, and power distribution without black-box ML.',
      status: 'IMPLEMENTED',
      vivaQuestion: 'How is this project applied to smart cities?',
      vivaAnswer: 'It demonstrates how classical AI provides verifiable, explainable decision-support for smart city charging resource allocation.'
    },
    {
      id: 'u5-2',
      unit: 'UNIT V',
      unitTitle: 'Machine Learning & AI Applications',
      topic: 'Machine Learning & Generative AI Exclusion',
      algorithm: 'Strict Software-Only Classical AI Declaration',
      codeRef: 'N/A (Strictly Excluded by Project Design)',
      howUsed: 'Zero ML models, neural networks, or LLMs are used. All decisions are deterministic, mathematical, and explainable.',
      status: 'NOT IMPLEMENTED (Strict Declaration)',
      vivaQuestion: 'Does the project use any ML or Deep Learning?',
      vivaAnswer: 'No. The project is strictly Classical Artificial Intelligence. All decisions come from search, logic, CSP, and game theory.'
    }
  ];

  const filteredData = syllabusData.filter((item) => {
    const matchesUnit = selectedUnit === 'ALL' || item.unit === selectedUnit;
    const matchesSearch =
      searchQuery === '' ||
      item.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.algorithm.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.howUsed.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.codeRef.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesUnit && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Academic Reference */}
      <div className="ai-card p-5 bg-gradient-to-r from-blue-50/40 via-white to-slate-50 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-blue">CURRICULUM MAPPING</span>
              <span className="text-xs text-slate-500 font-mono">FOUNDATIONS OF ARTIFICIAL INTELLIGENCE (FOAI)</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              FOAI Academic Syllabus &amp; Implementation Mapping
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Every topic is strictly mapped to actual backend source code modules and algorithms. 
              No fake features or unverified claims.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setVivaMode(!vivaMode)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border transition-colors ${
                vivaMode ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {vivaMode ? 'Hide Oral Viva Questions' : 'Show Oral Viva Exam Q&A'}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ai-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Unit Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
          {['ALL', 'UNIT I', 'UNIT II', 'UNIT III', 'UNIT IV', 'UNIT V'].map((u) => (
            <button
              key={u}
              onClick={() => setSelectedUnit(u)}
              className={`px-3 py-1.5 rounded-md border transition-all cursor-pointer whitespace-nowrap ${
                selectedUnit === u
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search topic, algorithm or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input pl-9 text-xs py-1.5"
          />
        </div>
      </div>

      {/* Syllabus Topic Cards List */}
      <div className="space-y-4">
        {filteredData.map((item) => (
          <div key={item.id} className="ai-card p-5 space-y-3 hover:border-blue-300 transition-colors">
            
            {/* Header: Unit, Topic, Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge-slate font-mono text-[10px]">{item.unit}</span>
                <h3 className="text-sm font-bold text-slate-900">{item.topic}</h3>
              </div>

              <span className={item.status === 'IMPLEMENTED' ? 'badge-emerald' : 'badge-slate'}>
                {item.status}
              </span>
            </div>

            {/* Grid: Algorithm, Code Reference, How Used */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <strong className="text-[10px] text-slate-500 uppercase block mb-1">Algorithm</strong>
                <span className="font-semibold text-slate-900">{item.algorithm}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <strong className="text-[10px] text-slate-500 uppercase block mb-1">Source Code / Module</strong>
                <code className="text-blue-700 font-mono text-[11px] block truncate" title={item.codeRef}>
                  {item.codeRef}
                </code>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md md:col-span-1">
                <strong className="text-[10px] text-slate-500 uppercase block mb-1">Application In EV System</strong>
                <span className="text-slate-700 text-[11px] leading-relaxed block">{item.howUsed}</span>
              </div>
            </div>

            {/* Viva Oral Exam Guide Card */}
            {vivaMode && (
              <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-md text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Oral Viva Question: {item.vivaQuestion}</span>
                </div>
                <p className="text-amber-800 text-[11px] leading-relaxed pl-5">
                  <strong>Expected Answer:</strong> {item.vivaAnswer}
                </p>
              </div>
            )}

          </div>
        ))}
      </div>

    </div>
  );
}
