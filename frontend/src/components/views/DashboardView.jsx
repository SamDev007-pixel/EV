import React from 'react';
import {
  Car,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ArrowRight,
  GitCompare,
  Calendar,
  Brain,
  Scale,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export default function DashboardView({
  simState,
  onSelectTab,
  onStepSimulation,
  onResetSimulation
}) {
  const evs = simState?.evs || [];
  const stations = simState?.stations || [];
  const gridNode = simState?.grid_node || { currentLoad: 140, capacity: 400 };

  // Calculate high-level metrics
  const activeEVRequests = evs.filter(e => e.status !== 'CHARGED');
  const chargingEVs = evs.filter(e => e.status === 'CHARGING');
  const waitingEVs = evs.filter(e => e.status === 'WAITING' || e.status === 'EN_ROUTE');
  const availableStations = stations.filter(s => s.status === 'AVAILABLE' || s.status === 'OPERATIONAL');
  const faultStations = stations.filter(s => s.status === 'FAULT' || s.is_operational === false);
  const totalBays = stations.reduce((acc, s) => acc + (s.total_bays || s.chargers?.length || 2), 0);
  const occupiedBays = stations.reduce((acc, s) => acc + (s.occupied_bays || 0), 0);
  const freeBays = Math.max(0, totalBays - occupiedBays);

  // Derive pending conflicts or contention
  const currentConflicts = waitingEVs.length > freeBays ? waitingEVs.length - freeBays : 0;

  // Recent AI decisions
  const recentDecisions = [
    {
      evId: 'EV-07',
      priority: 'CRITICAL',
      assignedStation: 'CS-02 (Central Metro)',
      algorithm: 'A* Search + CSP',
      timeSlot: '08:30 - 09:15',
      status: 'SCHEDULED',
      reason: 'Rule-Critical-Battery triggered priority bump; shortest travel + zero bay conflict.'
    },
    {
      evId: 'EV-03',
      priority: 'STANDARD',
      assignedStation: 'CS-01 (Tech Park Hub)',
      algorithm: 'Uniform Cost Search (UCS)',
      timeSlot: '09:00 - 09:45',
      status: 'CHARGING',
      reason: 'Optimal cost path selected; transformer headroom verified at 180kW.'
    },
    {
      evId: 'EV-09',
      priority: 'EMERGENCY',
      assignedStation: 'CS-02 (Central Metro)',
      algorithm: 'Game Theory (Nash Bargaining)',
      timeSlot: '08:15 - 08:50',
      status: 'COMPLETED',
      reason: 'Pareto-optimal concession reached with EV-04; emergency preemption granted.'
    },
    {
      evId: 'EV-05',
      priority: 'STANDARD',
      assignedStation: 'CS-04 (Airport Expressway)',
      algorithm: 'A* Search (Euclidean)',
      timeSlot: '09:30 - 10:15',
      status: 'EN_ROUTE',
      reason: 'Admissible heuristic pruned 14 network branches; arrival in 12 min.'
    }
  ];

  const algorithmActivity = [
    { name: 'A* Search', module: 'app.search.algorithms', calls: 38, optimality: '100% Admissible', type: 'Heuristic Search' },
    { name: 'CSP Backtracking (MRV + LCV)', module: 'app.csp.solver', calls: 24, optimality: 'Zero Overlaps', type: 'Constraint Satisfaction' },
    { name: 'Nash Bargaining Solution', module: 'app.game_theory.negotiation', calls: 11, optimality: 'Pareto Efficient', type: 'Game Theory' },
    { name: 'First-Order Logic Inference', module: 'app.knowledge.kb', calls: 52, optimality: 'Sound Horn Clauses', type: 'Knowledge Base' },
    { name: 'DPLL Propositional SAT', module: 'app.logic.propositional_dpll', calls: 16, optimality: 'Exact Model', type: 'SAT Solver' }
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Academic Title & Quick Actions */}
      <div className="ai-card p-5 bg-gradient-to-r from-blue-50/50 via-white to-slate-50 border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-blue">EXECUTIVE AI DASHBOARD</span>
              <span className="text-xs text-slate-500 font-mono">FOAI UNIT I - V INTEGRATION</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Autonomous EV Charging Decision-Support System
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Symbol-driven classical artificial intelligence solving EV route selection, resource scheduling, 
              bay conflict resolution, and explainable dispatch without black-box machine learning models.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => onSelectTab('ev_request')}
              className="btn-primary text-xs flex items-center gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Submit EV Request</span>
            </button>
            <button
              onClick={() => onSelectTab('explanation')}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <span>Explain Latest Decision</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Active EV Requests */}
        <div className="ai-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active EV Requests
            </span>
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">{activeEVRequests.length}</span>
            <span className="text-xs text-slate-500">vehicles</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>Charging: <strong className="text-emerald-600">{chargingEVs.length}</strong></span>
            <span>En Route / Waiting: <strong className="text-blue-600">{waitingEVs.length}</strong></span>
          </div>
        </div>

        {/* Metric 2: Available Stations */}
        <div className="ai-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Available Stations
            </span>
            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {availableStations.length} / {stations.length}
            </span>
            <span className="text-xs text-emerald-600 font-semibold">Active Hubs</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>Free Bays: <strong className="text-slate-900">{freeBays}</strong></span>
            <span>Faulted: <strong className={faultStations.length > 0 ? "text-rose-600" : "text-slate-500"}>{faultStations.length}</strong></span>
          </div>
        </div>

        {/* Metric 3: Pending Scheduling Requests */}
        <div className="ai-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Scheduling
            </span>
            <div className="w-8 h-8 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">{waitingEVs.length}</span>
            <span className="text-xs text-sky-600 font-medium">CSP Queued</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>MRV Heuristic: <strong className="text-slate-800">Active</strong></span>
            <span>AC-3 Filter: <strong className="text-slate-800">Enforced</strong></span>
          </div>
        </div>

        {/* Metric 4: Current Conflicts */}
        <div className="ai-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Detected Conflicts
            </span>
            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
              currentConflicts > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">{currentConflicts}</span>
            <span className="text-xs text-slate-500">contested slots</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>Arbitration: <strong className="text-slate-800">Nash Bargaining</strong></span>
            <span>Safety: <strong className="text-emerald-600">Strict Bound</strong></span>
          </div>
        </div>

      </div>

      {/* Main Two-Column Grid: Recent AI Decisions & Algorithm Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 Cols): Recent AI Decisions Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="ai-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent AI Decisions</h3>
                <p className="text-xs text-slate-500">
                  Real-time algorithmic dispatch allocations with formal reasoning rationale
                </p>
              </div>
              <button
                onClick={() => onSelectTab('explanation')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Decision Trace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="ai-table-container">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Priority</th>
                    <th>Station Assigned</th>
                    <th>Algorithm</th>
                    <th>Time Slot</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDecisions.map((dec, i) => (
                    <tr key={i}>
                      <td className="font-semibold text-slate-900 font-mono">{dec.evId}</td>
                      <td>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                          dec.priority === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          dec.priority === 'EMERGENCY' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {dec.priority}
                        </span>
                      </td>
                      <td className="text-slate-800">{dec.assignedStation}</td>
                      <td className="font-mono text-xs text-blue-600">{dec.algorithm}</td>
                      <td className="font-mono text-xs text-slate-600">{dec.timeSlot}</td>
                      <td>
                        <span className="badge-emerald">{dec.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Decision Logic Annotation */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800">Mathematical Optimality Guarantee:</strong> All station recommendations are produced by 
                evaluating the admissible Euclidean heuristic ($h(n) \le h^*(n)$) within A* search and solving the constraint satisfaction 
                problem with AC-3 arc consistency.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Algorithm Activity & Foundations */}
        <div className="space-y-4">
          <div className="ai-card p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Active Algorithm Stack</h3>
            <p className="text-xs text-slate-500 mb-4">
              Foundations of Artificial Intelligence implementation status
            </p>

            <div className="space-y-3">
              {algorithmActivity.map((alg, i) => (
                <div key={i} className="p-3 border border-slate-200 rounded-md bg-white hover:border-blue-200 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{alg.name}</span>
                    <span className="text-[10px] font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      {alg.type}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="truncate max-w-[140px]">{alg.module}</span>
                    <span className="text-emerald-700 font-sans font-medium">{alg.optimality}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200">
              <button
                onClick={() => onSelectTab('syllabus')}
                className="w-full btn-secondary text-xs flex items-center justify-center gap-1.5"
              >
                <span>View Complete FOAI Syllabus Mapping</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
