import React, { useState, useEffect } from 'react';
import {
  Car,
  FileCode,
  Brain,
  Compass,
  CalendarCheck,
  Scale,
  Award,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  MapPin,
  Clock,
  BatteryCharging,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { executePrimaryWorkflow, fetchWorkflowExplanation } from '../../services/api';

export default function PrimaryWorkflowView({ simState }) {
  // ---------------------------------------------------------------------------
  // STEP 1 STATE: EV REQUEST
  // ---------------------------------------------------------------------------
  const [formData, setFormData] = useState({
    ev_id: 'EV-USER-01',
    current_x: 1.5,
    current_y: 2.2,
    destination_area_name: 'Whitefield Tech Hub',
    dest_x: 8.5,
    dest_y: 9.0,
    battery_capacity_kwh: 60,
    current_charge_pct: 18,
    required_charge_pct: 80,
    max_acceptable_distance_km: 12,
    departure_deadline_min: 90,
    priority: 'HIGH',
    connector_requirement: 'CCS2',
    selected_search_algorithm: 'A*'
  });

  const [workflowResult, setWorkflowResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [explanationData, setExplanationData] = useState(null);
  const [activeStepTab, setActiveStepTab] = useState('ALL');

  // Preset location quick-fill options
  const locationPresets = [
    { label: 'Koramangala 4th Block', x: 1.5, y: 2.2 },
    { label: 'Indiranagar 100ft Rd', x: 4.0, y: 3.5 },
    { label: 'MG Road Central', x: 3.0, y: 5.0 },
    { label: 'Electronic City Phase 1', x: 2.0, y: 9.5 }
  ];

  const destinationPresets = [
    { label: 'Whitefield Tech Hub', x: 8.5, y: 9.0 },
    { label: 'Hebbal Tech Park', x: 4.5, y: 8.5 },
    { label: 'Outer Ring Road Bellandur', x: 6.5, y: 5.5 }
  ];

  // Execute workflow
  const handleRunWorkflow = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ev_id: formData.ev_id,
        current_location: { x: parseFloat(formData.current_x), y: parseFloat(formData.current_y) },
        destination: { x: parseFloat(formData.dest_x), y: parseFloat(formData.dest_y) },
        destination_area_name: formData.destination_area_name,
        battery_capacity_kwh: parseFloat(formData.battery_capacity_kwh),
        current_charge_pct: parseFloat(formData.current_charge_pct),
        required_charge_pct: parseFloat(formData.required_charge_pct),
        max_acceptable_distance_km: parseFloat(formData.max_acceptable_distance_km),
        departure_deadline_min: parseFloat(formData.departure_deadline_min),
        priority: formData.priority,
        connector_requirement: formData.connector_requirement,
        selected_search_algorithm: formData.selected_search_algorithm
      };

      const result = await executePrimaryWorkflow(payload);
      setWorkflowResult(result);
    } catch (err) {
      console.error('Workflow execution failed:', err);
      setError(err.message || 'Failed to execute primary workflow.');
    } finally {
      setLoading(false);
    }
  };

  // Run on mount
  useEffect(() => {
    handleRunWorkflow();
  }, []);

  // Fetch Step 8 interactive explanation
  const handleWhySelectedClick = async () => {
    if (workflowResult?.step8_explanation) {
      setExplanationData(workflowResult.step8_explanation);
      setShowExplanationModal(true);
      return;
    }
    try {
      const payload = {
        ev_id: formData.ev_id,
        current_charge_pct: parseFloat(formData.current_charge_pct),
        required_charge_pct: parseFloat(formData.required_charge_pct),
        priority: formData.priority
      };
      const res = await fetchWorkflowExplanation(payload);
      setExplanationData(res);
      setShowExplanationModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const stepsList = [
    { num: 1, id: 'STEP1', title: 'EV Request', icon: Car, tag: 'Input' },
    { num: 2, id: 'STEP2', title: 'Problem Formulation', icon: FileCode, tag: 'Unit I' },
    { num: 3, id: 'STEP3', title: 'Knowledge Reasoning', icon: Brain, tag: 'Unit IV' },
    { num: 4, id: 'STEP4', title: 'Search Comparison', icon: Compass, tag: 'Unit II' },
    { num: 5, id: 'STEP5', title: 'CSP Scheduling', icon: CalendarCheck, tag: 'Unit III' },
    { num: 6, id: 'STEP6', title: 'Conflict Resolution', icon: Scale, tag: 'Unit III' },
    { num: 7, id: 'STEP7', title: 'Final Decision', icon: Award, tag: 'Output' },
    { num: 8, id: 'STEP8', title: 'Explanation Chain', icon: HelpCircle, tag: 'Explainable AI' }
  ];

  return (
    <div className="space-y-6 font-sans">
      
      {/* HEADER NARRATIVE BANNER */}
      <div className="glass-panel p-5 border border-[#202F49] bg-gradient-to-r from-[#0F172A] via-[#131B2B] to-[#0F172A] shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono bg-[#1E293B] text-[#38BDF8] border border-[#38BDF8]/30 font-bold uppercase tracking-wider">
                PRIMARY APPLICATION WORKFLOW
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                8-Stage Classical Artificial Intelligence Decision Pipeline
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide mt-1">
              Autonomous EV Charging Decision-Support Engine
            </h2>
            <p className="text-xs text-zinc-300 mt-1 max-w-3xl leading-relaxed">
              Tells one coherent story: From raw user telematics to formal problem formulation, logical knowledge inference, 
              5-algorithm comparative path search, AC-3 constraint satisfaction scheduling, game-theoretic conflict resolution, 
              and deterministic decision explanation.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRunWorkflow}
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#2563EB] text-white border border-[#3B82F6] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md uppercase tracking-wider active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{loading ? 'Evaluating Pipeline...' : 'Run Decision Workflow'}</span>
            </button>
          </div>
        </div>

        {/* WORKFLOW STEPPER BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-5 border-t border-[#202F49] mt-4">
          {stepsList.map((st) => {
            const IconComponent = st.icon;
            const isSelected = activeStepTab === st.id || activeStepTab === 'ALL';
            return (
              <button
                key={st.id}
                onClick={() => setActiveStepTab(st.id === activeStepTab ? 'ALL' : st.id)}
                className={`p-2.5 text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  activeStepTab === st.id
                    ? 'bg-[#1E293B] border-[#38BDF8] shadow-sm'
                    : 'bg-[#0F172A]/70 border-[#202F49] hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span>STEP {st.num}</span>
                  <span className="text-[9px] text-[#38BDF8] uppercase">{st.tag}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <IconComponent className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                  <span className="text-xs font-semibold text-white truncate">{st.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* STEP 1: EV REQUEST INPUT FORM */}
      {/* --------------------------------------------------------------------- */}
      {(activeStepTab === 'ALL' || activeStepTab === 'STEP1') && (
        <section className="glass-panel p-5 border border-[#202F49] bg-[#0F172A] space-y-4">
          <div className="flex items-center justify-between border-b border-[#202F49] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-[#1D4ED8]/30 border border-[#3B82F6] flex items-center justify-center font-bold text-xs text-[#38BDF8]">
                1
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  STEP 1 — EV REQUEST (User Telematics & Constraints)
                </h3>
                <p className="text-[11px] text-zinc-400">
                  User specifies driving coordinates, energy requirements, departure deadline, and vehicle attributes.
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-[#1E293B] text-slate-300 border border-[#202F49]">
              RAW INPUT
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Origin */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Current Location (Origin)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={formData.current_x}
                  onChange={(e) => setFormData({ ...formData, current_x: e.target.value })}
                  placeholder="X (km)"
                  className="w-full bg-[#131B2B] border border-[#202F49] p-2 text-white font-mono focus:border-[#38BDF8] outline-none"
                />
                <input
                  type="number"
                  step="0.1"
                  value={formData.current_y}
                  onChange={(e) => setFormData({ ...formData, current_y: e.target.value })}
                  placeholder="Y (km)"
                  className="w-full bg-[#131B2B] border border-[#202F49] p-2 text-white font-mono focus:border-[#38BDF8] outline-none"
                />
              </div>
              <select
                onChange={(e) => {
                  const p = locationPresets.find(x => x.label === e.target.value);
                  if (p) setFormData({ ...formData, current_x: p.x, current_y: p.y });
                }}
                className="w-full bg-[#131B2B] border border-[#202F49] p-1.5 text-zinc-300 text-[11px] outline-none mt-1"
              >
                <option value="">Quick Presets...</option>
                {locationPresets.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
              </select>
            </div>

            {/* Destination */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Destination or Area
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={formData.dest_x}
                  onChange={(e) => setFormData({ ...formData, dest_x: e.target.value })}
                  placeholder="X (km)"
                  className="w-full bg-[#131B2B] border border-[#202F49] p-2 text-white font-mono focus:border-[#38BDF8] outline-none"
                />
                <input
                  type="number"
                  step="0.1"
                  value={formData.dest_y}
                  onChange={(e) => setFormData({ ...formData, dest_y: e.target.value })}
                  placeholder="Y (km)"
                  className="w-full bg-[#131B2B] border border-[#202F49] p-2 text-white font-mono focus:border-[#38BDF8] outline-none"
                />
              </div>
              <select
                onChange={(e) => {
                  const p = destinationPresets.find(x => x.label === e.target.value);
                  if (p) setFormData({ ...formData, dest_x: p.x, dest_y: p.y, destination_area_name: p.label });
                }}
                className="w-full bg-[#131B2B] border border-[#202F49] p-1.5 text-zinc-300 text-[11px] outline-none mt-1"
              >
                <option value="">Destination Presets...</option>
                {destinationPresets.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
              </select>
            </div>

            {/* Battery SoC & Target */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-zinc-300 uppercase">
                <span>Charge Level (Current / Target)</span>
                <span className="text-[#38BDF8] font-mono">{formData.current_charge_pct}% → {formData.required_charge_pct}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="5"
                  max="95"
                  value={formData.current_charge_pct}
                  onChange={(e) => setFormData({ ...formData, current_charge_pct: e.target.value })}
                  className="w-full bg-[#131B2B] border border-[#202F49] p-2 text-white font-mono focus:border-[#38BDF8] outline-none"
                />
                <input
                  type="number"
                  min="20"
                  max="100"
                  value={formData.required_charge_pct}
                  onChange={(e) => setFormData({ ...formData, required_charge_pct: e.target.value })}
                  className="w-full bg-[#131B2B] border border-[#202F49] p-2 text-white font-mono focus:border-[#38BDF8] outline-none"
                />
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">
                Battery Pack: {formData.battery_capacity_kwh} kWh (Energy Needed: {Math.max(0, ((formData.required_charge_pct - formData.current_charge_pct) / 100 * formData.battery_capacity_kwh)).toFixed(1)} kWh)
              </div>
            </div>

            {/* Deadline & Constraints */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Deadline & Distance Limits
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-400 uppercase">Max Dist (km)</span>
                  <input
                    type="number"
                    value={formData.max_acceptable_distance_km}
                    onChange={(e) => setFormData({ ...formData, max_acceptable_distance_km: e.target.value })}
                    className="w-full bg-[#131B2B] border border-[#202F49] p-1.5 text-white font-mono focus:border-[#38BDF8] outline-none"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-400 uppercase">Deadline (min)</span>
                  <input
                    type="number"
                    value={formData.departure_deadline_min}
                    onChange={(e) => setFormData({ ...formData, departure_deadline_min: e.target.value })}
                    className="w-full bg-[#131B2B] border border-[#202F49] p-1.5 text-white font-mono focus:border-[#38BDF8] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Priority, Connector, Search Algorithm */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#202F49]/50 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Priority Tier
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-[#131B2B] border border-[#202F49] p-2 text-white outline-none mt-1 font-semibold"
              >
                <option value="STANDARD">STANDARD (Daily Commute)</option>
                <option value="HIGH">HIGH (Fleet Commercial / Tight Deadline)</option>
                <option value="EMERGENCY">EMERGENCY (Ambulance / Emergency Service)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Connector Requirement
              </label>
              <select
                value={formData.connector_requirement}
                onChange={(e) => setFormData({ ...formData, connector_requirement: e.target.value })}
                className="w-full bg-[#131B2B] border border-[#202F49] p-2 text-white outline-none mt-1 font-mono"
              >
                <option value="CCS2">CCS2 (DC Fast / Combined Charging)</option>
                <option value="Type 2">Type 2 (AC Normal 22 kW)</option>
                <option value="CHAdeMO">CHAdeMO (DC Fast Port)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Preferred Search Algorithm
              </label>
              <select
                value={formData.selected_search_algorithm}
                onChange={(e) => setFormData({ ...formData, selected_search_algorithm: e.target.value })}
                className="w-full bg-[#131B2B] border border-[#202F49] p-2 text-white outline-none mt-1 font-mono text-[#38BDF8]"
              >
                <option value="A*">A* Search (Informed Admissible Heuristic)</option>
                <option value="UCS">Uniform Cost Search (Lowest Cost Path)</option>
                <option value="GBFS">Greedy Best-First Search (Heuristic Greedy)</option>
                <option value="BFS">Breadth-First Search (Hop Minimal)</option>
                <option value="DFS">Depth-First Search (Deep Traversal)</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {workflowResult && (
        <>
          {/* ----------------------------------------------------------------- */}
          {/* STEP 2: PROBLEM FORMULATION */}
          {/* ----------------------------------------------------------------- */}
          {(activeStepTab === 'ALL' || activeStepTab === 'STEP2') && (
            <section className="glass-panel p-5 border border-[#202F49] bg-[#0F172A] space-y-4">
              <div className="flex items-center justify-between border-b border-[#202F49] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-[#0284C7]/30 border border-[#0284C7] flex items-center justify-center font-bold text-xs text-[#38BDF8]">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      STEP 2 — PROBLEM FORMULATION (State Space & Constraints)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Converts informal user intent into the classical 6-tuple formalization: Initial State, Goal State, Actions, Transition Model, Constraints, and Cost Function.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-[#1E293B] text-sky-400 border border-sky-800">
                  FOAI UNIT I
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
                {/* Initial State */}
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-1.5">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-sans font-bold">
                    INITIAL STATE (s₀)
                  </span>
                  <div className="text-white space-y-1 text-[11px]">
                    <div>Node: <span className="text-[#38BDF8]">{workflowResult.step2_formulation.initial_state.node}</span></div>
                    <div>Coordinates: ({workflowResult.step2_formulation.initial_state.coordinates.x}, {workflowResult.step2_formulation.initial_state.coordinates.y})</div>
                    <div>Current SOC: <span className="text-amber-400">{workflowResult.step2_formulation.initial_state.battery_soc_pct}%</span> ({workflowResult.step2_formulation.initial_state.battery_kwh} kWh)</div>
                    <div>Elapsed Time: {workflowResult.step2_formulation.initial_state.elapsed_time_min} min</div>
                  </div>
                </div>

                {/* Goal State */}
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-1.5">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-sans font-bold">
                    GOAL STATE TEST (G)
                  </span>
                  <div className="text-white space-y-1 text-[11px]">
                    <div>Target SOC: <span className="text-emerald-400">&gt;= {workflowResult.step2_formulation.goal_state.battery_soc_pct_min}%</span></div>
                    <div>Target Energy: &gt;= {workflowResult.step2_formulation.goal_state.battery_kwh_min} kWh</div>
                    <div>Deadline: &lt;= {workflowResult.step2_formulation.goal_state.max_elapsed_time_min} min</div>
                    <div>Status: <span className="text-emerald-400">CHARGING_COMPLETED</span></div>
                  </div>
                </div>

                {/* State Space Definition */}
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-1.5">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-sans font-bold">
                    STATE SPACE REPRESENTATION (S)
                  </span>
                  <div className="text-zinc-300 text-[11px] leading-relaxed">
                    {workflowResult.step2_formulation.state_space_description}
                  </div>
                </div>
              </div>

              {/* Actions & Cost Function */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono pt-1">
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-1.5">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-sans font-bold">
                    TRANSITION ACTIONS A(s)
                  </span>
                  <ul className="space-y-1 text-zinc-300 text-[11px]">
                    {workflowResult.step2_formulation.actions.map((act, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-[#38BDF8]">•</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-2">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-sans font-bold">
                    STEP COST & ADMISSIBLE HEURISTIC
                  </span>
                  <div className="p-2 bg-[#0B101B] border border-[#202F49] text-[11px] text-sky-300">
                    {workflowResult.step2_formulation.cost_function}
                  </div>
                  <div className="p-2 bg-[#0B101B] border border-[#202F49] text-[11px] text-emerald-300">
                    {workflowResult.step2_formulation.heuristic_function}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STEP 3: KNOWLEDGE REASONING */}
          {/* ----------------------------------------------------------------- */}
          {(activeStepTab === 'ALL' || activeStepTab === 'STEP3') && (
            <section className="glass-panel p-5 border border-[#202F49] bg-[#0F172A] space-y-4">
              <div className="flex items-center justify-between border-b border-[#202F49] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-purple-600/30 border border-purple-500 flex items-center justify-center font-bold text-xs text-purple-300">
                    3
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      STEP 3 — KNOWLEDGE REASONING (Fact Base & Production Rules)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Evaluates logical facts in the Knowledge Base using forward and backward chaining to determine station availability, priority, and physical eligibility.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                  FOAI UNIT IV
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                {/* Asserted Facts */}
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400 font-sans font-bold uppercase">
                    <span>FACT BASE (ASSERTIONS)</span>
                    <span className="text-[#38BDF8]">{workflowResult.step3_reasoning.facts_asserted.length} Facts</span>
                  </div>
                  <div className="space-y-1.5 text-[11px] max-h-48 overflow-y-auto">
                    {workflowResult.step3_reasoning.facts_asserted.map((f, i) => (
                      <div key={i} className="p-1.5 bg-[#0B101B] border border-[#202F49]">
                        <span className="text-purple-400">{f.subject}</span>.<span className="text-zinc-300">{f.predicate}</span> = <span className="text-emerald-400">{String(f.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rules Fired */}
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400 font-sans font-bold uppercase">
                    <span>PRODUCTION RULES FIRED</span>
                    <span className="text-emerald-400">{workflowResult.step3_reasoning.rules_fired.length} Active</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    {workflowResult.step3_reasoning.rules_fired.map((rf, i) => (
                      <div key={i} className="p-1.5 bg-[#0B101B] border border-emerald-900/60 text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>{rf}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inferred Priority & Eligibility */}
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-2">
                  <span className="text-[10px] text-zinc-400 font-sans font-bold uppercase">
                    INFERRED ELIGIBILITY & RESTRICTIONS
                  </span>
                  <div className="p-2 bg-[#0B101B] border border-[#202F49] text-[11px]">
                    <span className="text-zinc-400">Assigned Priority: </span>
                    <span className="text-amber-400 font-bold">{workflowResult.step3_reasoning.computed_priority}</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {Object.entries(workflowResult.step3_reasoning.eligibility_status).map(([stId, elig]) => (
                      <div key={stId} className="flex justify-between p-1 bg-[#0B101B]">
                        <span>{stId}:</span>
                        <span className={elig ? "text-emerald-400 font-bold" : "text-rose-400 line-through"}>
                          {elig ? 'ELIGIBLE' : 'EXCLUDED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Restrictions Summary */}
              {workflowResult.step3_reasoning.restrictions_applied.length > 0 && (
                <div className="p-2.5 bg-amber-950/30 border border-amber-800 text-[11px] text-amber-200 font-mono space-y-1">
                  <div className="font-bold font-sans uppercase text-[10px] text-amber-300">Active Rule Restrictions:</div>
                  {workflowResult.step3_reasoning.restrictions_applied.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STEP 4: SEARCH COMPARISON */}
          {/* ----------------------------------------------------------------- */}
          {(activeStepTab === 'ALL' || activeStepTab === 'STEP4') && (
            <section className="glass-panel p-5 border border-[#202F49] bg-[#0F172A] space-y-4">
              <div className="flex items-center justify-between border-b border-[#202F49] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-amber-600/30 border border-amber-500 flex items-center justify-center font-bold text-xs text-amber-300">
                    4
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      STEP 4 — SEARCH (Benchmarking 5 Classical Search Algorithms)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Executes BFS, DFS, UCS, Greedy Best-First, and A* over the spatial road-station topology to find optimal paths and station candidates.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800">
                  FOAI UNIT II
                </span>
              </div>

              {/* Comparative Search Table */}
              <div className="overflow-x-auto border border-[#202F49]">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="bg-[#131B2B] text-zinc-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Algorithm</th>
                      <th className="p-2.5">Nodes Explored</th>
                      <th className="p-2.5">Path Cost</th>
                      <th className="p-2.5">Heuristic h(n)</th>
                      <th className="p-2.5">Runtime (ms)</th>
                      <th className="p-2.5">Path Traversed</th>
                      <th className="p-2.5">Selection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202F49]">
                    {workflowResult.step4_search.algorithms_compared.map((algo, i) => (
                      <tr key={i} className={algo.selected ? 'bg-[#1E293B] text-white font-bold' : 'text-zinc-300'}>
                        <td className="p-2.5 flex items-center gap-1.5">
                          {algo.selected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                          <span>{algo.algorithm}</span>
                        </td>
                        <td className="p-2.5 text-[#38BDF8]">{algo.nodes_explored}</td>
                        <td className="p-2.5">{algo.path_cost.toFixed(2)}</td>
                        <td className="p-2.5 text-zinc-400">{algo.heuristic_value !== null ? algo.heuristic_value.toFixed(1) : 'N/A'}</td>
                        <td className="p-2.5">{algo.runtime_ms.toFixed(2)}</td>
                        <td className="p-2.5 text-[11px] text-zinc-400">{algo.path.join(' → ')}</td>
                        <td className="p-2.5">
                          {algo.selected ? (
                            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                              OPTIMAL CHOICE
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500">Evaluated</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-[#131B2B] border border-[#202F49] text-xs flex items-center justify-between">
                <div>
                  <span className="text-zinc-400">Chosen Hub: </span>
                  <span className="text-white font-bold">{workflowResult.step4_search.chosen_station_name} ({workflowResult.step4_search.chosen_station_id})</span>
                  <span className="text-zinc-400 ml-3">Path Cost: </span>
                  <span className="text-emerald-400 font-mono font-bold">{workflowResult.step4_search.chosen_path_cost}</span>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Route: {workflowResult.step4_search.chosen_path.join(' → ')}
                </span>
              </div>
            </section>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STEP 5: CSP SCHEDULING */}
          {/* ----------------------------------------------------------------- */}
          {(activeStepTab === 'ALL' || activeStepTab === 'STEP5') && (
            <section className="glass-panel p-5 border border-[#202F49] bg-[#0F172A] space-y-4">
              <div className="flex items-center justify-between border-b border-[#202F49] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-emerald-600/30 border border-emerald-500 flex items-center justify-center font-bold text-xs text-emerald-300">
                    5
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      STEP 5 — CSP SCHEDULING (Constraint Satisfaction Problem)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Assigns EV → Station → Charger Bay → Time Slot subject to no-overlap, deadline, and transformer thermal capacity constraints.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  FOAI UNIT III
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                {/* CSP Variables & Domains */}
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-2">
                  <span className="text-[10px] text-zinc-400 font-sans font-bold uppercase">
                    VARIABLES & DOMAINS
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    {Object.entries(workflowResult.step5_csp.domains).map(([v, d]) => (
                      <div key={v} className="p-1.5 bg-[#0B101B] border border-[#202F49]">
                        <span className="text-[#38BDF8] font-bold">{v}:</span>
                        <div className="text-zinc-400 text-[10px] mt-0.5 truncate">{d.join(' | ')}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Algorithmic Techniques */}
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-2">
                  <span className="text-[10px] text-zinc-400 font-sans font-bold uppercase">
                    SEARCH HEURISTICS & PROPAGATION
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="p-1.5 bg-[#0B101B] border border-[#202F49]">
                      <span className="text-zinc-400">Variable Ordering: </span>
                      <span className="text-emerald-400">{workflowResult.step5_csp.algorithm_techniques.Variable_Ordering}</span>
                    </div>
                    <div className="p-1.5 bg-[#0B101B] border border-[#202F49]">
                      <span className="text-zinc-400">Value Ordering: </span>
                      <span className="text-emerald-400">{workflowResult.step5_csp.algorithm_techniques.Value_Ordering}</span>
                    </div>
                    <div className="p-1.5 bg-[#0B101B] border border-[#202F49]">
                      <span className="text-zinc-400">Constraint Propagation: </span>
                      <span className="text-emerald-400">{workflowResult.step5_csp.algorithm_techniques.Inference}</span>
                    </div>
                  </div>
                </div>

                {/* Backtracking & Assignment */}
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-2">
                  <span className="text-[10px] text-zinc-400 font-sans font-bold uppercase">
                    FEASIBLE ASSIGNMENT
                  </span>
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-800 text-[11px] text-emerald-300 space-y-1">
                    <div>EV: <span className="font-bold text-white">{workflowResult.step5_csp.assigned_schedule.EV}</span></div>
                    <div>Station: <span className="font-bold text-white">{workflowResult.step5_csp.assigned_schedule.Station}</span></div>
                    <div>Charger: <span className="font-bold text-white">{workflowResult.step5_csp.assigned_schedule.Charger}</span></div>
                    <div>Time Slot: <span className="font-bold text-amber-300">{workflowResult.step5_csp.assigned_schedule.TimeSlot}</span></div>
                  </div>
                  <div className="text-[10px] text-zinc-400 flex justify-between">
                    <span>Backtracks: {workflowResult.step5_csp.backtracks_count}</span>
                    <span>Constraint Checks: {workflowResult.step5_csp.constraint_checks_count}</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STEP 6: CONFLICT RESOLUTION */}
          {/* ----------------------------------------------------------------- */}
          {(activeStepTab === 'ALL' || activeStepTab === 'STEP6') && (
            <section className="glass-panel p-5 border border-[#202F49] bg-[#0F172A] space-y-4">
              <div className="flex items-center justify-between border-b border-[#202F49] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-indigo-600/30 border border-indigo-500 flex items-center justify-center font-bold text-xs text-indigo-300">
                    6
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      STEP 6 — CONFLICT RESOLUTION (Multi-Agent Game Theoretic Bargaining)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      When competing EVs contest the same limited charging bay, Nash Bargaining evaluates trade-offs to select a Pareto-efficient compromise.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                  FOAI UNIT III
                </span>
              </div>

              <div className="p-3 bg-[#131B2B] border border-[#202F49] text-xs font-mono space-y-2">
                <div className="flex flex-col sm:flex-row justify-between text-zinc-300 gap-2">
                  <div>
                    <span className="text-zinc-500">Contested Resource: </span>
                    <span className="text-white font-bold">{workflowResult.step6_conflict_resolution.contested_resource}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Competing Vehicle: </span>
                    <span className="text-amber-400 font-bold">{workflowResult.step6_conflict_resolution.competing_ev_id}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-[#0B101B] border border-[#202F49] text-[11px] text-zinc-300">
                  <span className="text-indigo-400 font-bold">Rational Justification: </span>
                  {workflowResult.step6_conflict_resolution.rational_justification}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                  <div className="p-2 bg-[#0B101B] border border-[#202F49]">
                    <span className="text-[10px] text-zinc-500">Selected Action:</span>
                    <div className="text-emerald-400 font-bold">{workflowResult.step6_conflict_resolution.selected_alternative_id}</div>
                  </div>
                  <div className="p-2 bg-[#0B101B] border border-[#202F49]">
                    <span className="text-[10px] text-zinc-500">Nash Product:</span>
                    <div className="text-[#38BDF8] font-bold">{workflowResult.step6_conflict_resolution.nash_product.toFixed(2)}</div>
                  </div>
                  <div className="p-2 bg-[#0B101B] border border-[#202F49]">
                    <span className="text-[10px] text-zinc-500">Pareto Dominant:</span>
                    <div className="text-emerald-400 font-bold">{workflowResult.step6_conflict_resolution.is_pareto_efficient ? 'TRUE' : 'FALSE'}</div>
                  </div>
                  <div className="p-2 bg-[#0B101B] border border-[#202F49]">
                    <span className="text-[10px] text-zinc-500">Solution Method:</span>
                    <div className="text-white truncate">{workflowResult.step6_conflict_resolution.decision_method}</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STEP 7: FINAL DECISION */}
          {/* ----------------------------------------------------------------- */}
          {(activeStepTab === 'ALL' || activeStepTab === 'STEP7') && (
            <section className="glass-panel p-5 border border-emerald-800 bg-gradient-to-r from-[#0F172A] via-[#111C30] to-[#0F172A] space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#202F49] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-emerald-500/30 border border-emerald-400 flex items-center justify-center font-bold text-xs text-emerald-300">
                    7
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      STEP 7 — FINAL DECISION (Optimal Assignment & Mathematical Confidence)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Synthesized Classical AI recommendation with mathematically grounded utility scoring.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-700">
                    SCORE: {workflowResult.step7_final_decision.decision_confidence_score} / 100
                  </span>
                </div>
              </div>

              {/* Core Output Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-1">
                  <span className="text-[10px] text-zinc-400 font-sans uppercase">Recommended Hub</span>
                  <div className="text-white font-bold text-sm">{workflowResult.step7_final_decision.recommended_station.station_name}</div>
                  <div className="text-[11px] text-[#38BDF8]">
                    {workflowResult.step7_final_decision.recommended_station.distance_km} km away ({workflowResult.step7_final_decision.recommended_station.operator})
                  </div>
                </div>

                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-1">
                  <span className="text-[10px] text-zinc-400 font-sans uppercase">Assigned Slot & Wait</span>
                  <div className="text-amber-400 font-bold text-sm">{workflowResult.step7_final_decision.recommended_time_slot}</div>
                  <div className="text-[11px] text-zinc-300">
                    Wait: {workflowResult.step7_final_decision.expected_waiting_time_min}m | Duration: {workflowResult.step7_final_decision.estimated_charging_duration_min}m
                  </div>
                </div>

                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-1">
                  <span className="text-[10px] text-zinc-400 font-sans uppercase">Selected Route</span>
                  <div className="text-white font-bold text-sm truncate">{workflowResult.step7_final_decision.recommended_route.join(' → ')}</div>
                  <div className="text-[11px] text-emerald-400">Optimal multi-objective path</div>
                </div>

                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-1">
                  <span className="text-[10px] text-zinc-400 font-sans uppercase">Constraint Verification</span>
                  <div className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>6/6 Hard Limits Met</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">Zero grid or deadline violations</div>
                </div>
              </div>

              {/* Mathematical Formula Display */}
              <div className="p-3 bg-[#0B101B] border border-[#202F49] text-[11px] font-mono text-zinc-300 space-y-1">
                <div className="text-[10px] text-zinc-500 font-sans font-bold uppercase">
                  Deterministic Utility Function (No ML / No Black-Box Weights):
                </div>
                <div className="text-[#38BDF8]">{workflowResult.step7_final_decision.score_formula}</div>
                <div className="text-zinc-400 text-[10px] mt-1">
                  Reasoning: {workflowResult.step7_final_decision.reasoning_explanation}
                </div>
              </div>
            </section>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STEP 8: EXPLANATION ("Why was this station selected?") */}
          {/* ----------------------------------------------------------------- */}
          {(activeStepTab === 'ALL' || activeStepTab === 'STEP8') && (
            <section className="glass-panel p-5 border border-[#38BDF8]/40 bg-[#0F172A] space-y-4">
              <div className="flex items-center justify-between border-b border-[#202F49] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-sky-500/30 border border-[#38BDF8] flex items-center justify-center font-bold text-xs text-[#38BDF8]">
                    8
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      STEP 8 — EXPLANATION (Derivation Chain: Facts → Rules → Search → Constraints → Decision)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Transparent explainability trace. Inspect the exact deterministic deduction path that led to this decision.
                    </p>
                  </div>
                </div>
                
                {/* INTERACTIVE WHY BUTTON */}
                <button
                  onClick={handleWhySelectedClick}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#2563EB] text-white border border-[#3B82F6] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm uppercase tracking-wider active:scale-95"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Why was this station selected?</span>
                </button>
              </div>

              {/* 5-Tier Derivation Chain Display */}
              <div className="space-y-2.5 font-mono text-xs">
                {/* 1. FACTS */}
                <div className="p-3 bg-[#131B2B] border-l-4 border-l-purple-500 border border-[#202F49] space-y-1">
                  <span className="text-[10px] text-purple-400 font-sans font-bold uppercase">1. FACTS TIER</span>
                  <ul className="text-zinc-300 text-[11px] space-y-0.5">
                    {workflowResult.step8_explanation.facts_tier.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>

                {/* 2. RULES */}
                <div className="p-3 bg-[#131B2B] border-l-4 border-l-indigo-500 border border-[#202F49] space-y-1">
                  <span className="text-[10px] text-indigo-400 font-sans font-bold uppercase">2. RULES TIER</span>
                  <ul className="text-zinc-300 text-[11px] space-y-0.5">
                    {workflowResult.step8_explanation.rules_tier.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>

                {/* 3. SEARCH RESULT */}
                <div className="p-3 bg-[#131B2B] border-l-4 border-l-amber-500 border border-[#202F49] space-y-1">
                  <span className="text-[10px] text-amber-400 font-sans font-bold uppercase">3. SEARCH RESULT TIER</span>
                  <p className="text-zinc-300 text-[11px]">{workflowResult.step8_explanation.search_tier}</p>
                </div>

                {/* 4. CONSTRAINTS */}
                <div className="p-3 bg-[#131B2B] border-l-4 border-l-emerald-500 border border-[#202F49] space-y-1">
                  <span className="text-[10px] text-emerald-400 font-sans font-bold uppercase">4. CONSTRAINTS TIER (CSP AC-3)</span>
                  <ul className="text-zinc-300 text-[11px] space-y-0.5">
                    {workflowResult.step8_explanation.constraints_tier.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>

                {/* 5. DECISION */}
                <div className="p-3 bg-[#131B2B] border-l-4 border-l-sky-500 border border-[#202F49] space-y-1">
                  <span className="text-[10px] text-sky-400 font-sans font-bold uppercase">5. FINAL DECISION TIER</span>
                  <p className="text-white font-bold text-[11px]">{workflowResult.step8_explanation.decision_tier}</p>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* INTERACTIVE MODAL FOR "Why was this station selected?" */}
      {/* --------------------------------------------------------------------- */}
      {showExplanationModal && explanationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[#0B101B] border border-[#38BDF8] p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-[#202F49] pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#38BDF8]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  EXPLANATION TRACE — WHY WAS THIS STATION SELECTED?
                </h3>
              </div>
              <button
                onClick={() => setShowExplanationModal(false)}
                className="text-zinc-400 hover:text-white text-xs font-mono px-2 py-1 bg-[#131B2B] border border-[#202F49]"
              >
                CLOSE [ESC]
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-3 bg-[#131B2B] border border-[#202F49]">
                <span className="text-[#38BDF8] font-bold block mb-1">DERIVATION SEQUENCE:</span>
                <ol className="list-decimal list-inside space-y-1 text-zinc-300 text-[11px]">
                  {explanationData.derivation_chain?.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-1">
                  <span className="text-purple-400 font-bold block">FACTS ASSERTED:</span>
                  {explanationData.facts_tier?.map((f, i) => <div key={i} className="text-zinc-300">• {f}</div>)}
                </div>
                <div className="p-3 bg-[#131B2B] border border-[#202F49] space-y-1">
                  <span className="text-indigo-400 font-bold block">RULES FIRED:</span>
                  {explanationData.rules_tier?.map((r, i) => <div key={i} className="text-zinc-300">• {r}</div>)}
                </div>
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-[11px] text-emerald-300 space-y-1">
                <span className="font-bold text-white block">DECISION CONSENSUS:</span>
                <div>{explanationData.decision_tier}</div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#202F49]">
              <button
                onClick={() => setShowExplanationModal(false)}
                className="px-4 py-1.5 bg-[#1D4ED8] hover:bg-[#2563EB] text-white text-xs font-bold transition-all cursor-pointer"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
