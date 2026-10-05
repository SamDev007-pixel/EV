import React, { useState, useEffect } from 'react';
import {
  FileEdit,
  Zap,
  MapPin,
  Clock,
  Battery,
  Shield,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  Calculator,
  Code
} from 'lucide-react';
import { executePrimaryWorkflow, formulateProblem } from '../../services/api';

export default function EVRequestView({ onSelectTab, onWorkflowExecuted }) {
  // Preset scenarios
  const presets = {
    commuter: {
      name: 'Commuter Rush',
      desc: 'Urban commuter with depleted battery needing fast top-up before morning office arrival.',
      ev_id: 'EV-COMMUTER-01',
      x0: 1.2,
      y0: 2.5,
      xd: 8.5,
      yd: 9.0,
      area: 'Whitefield Tech Hub',
      capacity: 60.0,
      current_soc: 18.0,
      target_soc: 80.0,
      max_distance: 15.0,
      deadline: 90.0,
      priority: 'STANDARD',
      connector: 'CCS2',
      algorithm: 'A*'
    },
    emergency: {
      name: 'Emergency Fleet Vehicle',
      desc: 'Critical medical transport needing guaranteed bay preemption with sub-20% battery reserve.',
      ev_id: 'EV-AMBULANCE-09',
      x0: 3.0,
      y0: 1.5,
      xd: 7.2,
      yd: 6.8,
      area: 'City Hospital Campus',
      capacity: 75.0,
      current_soc: 12.0,
      target_soc: 85.0,
      max_distance: 20.0,
      deadline: 45.0,
      priority: 'EMERGENCY',
      connector: 'CCS2',
      algorithm: 'A*'
    },
    transit: {
      name: 'Highway Transit',
      desc: 'Long-distance inter-city courier requiring high capacity replenishment along expressway corridor.',
      ev_id: 'EV-TRANSIT-04',
      x0: 0.5,
      y0: 8.0,
      xd: 9.8,
      yd: 1.2,
      area: 'Southern Industrial Corridor',
      capacity: 85.0,
      current_soc: 25.0,
      target_soc: 90.0,
      max_distance: 25.0,
      deadline: 120.0,
      priority: 'HIGH',
      connector: 'Type 2',
      algorithm: 'Uniform Cost Search (UCS)'
    }
  };

  const [activePreset, setActivePreset] = useState('commuter');
  const [formData, setFormData] = useState({ ...presets.commuter });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Live Backend Problem Formulation State
  const [backendFormulation, setBackendFormulation] = useState(null);
  const [formulationLoading, setFormulationLoading] = useState(false);

  const handleApplyPreset = (key) => {
    setActivePreset(key);
    setFormData({ ...presets[key] });
    setResult(null);
    setError(null);
  };

  const handleReset = () => {
    setActivePreset('commuter');
    setFormData({ ...presets.commuter });
    setResult(null);
    setError(null);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Input Validation
  const isSocInvalid = parseFloat(formData.current_soc) >= parseFloat(formData.target_soc);
  const isDistanceInvalid = parseFloat(formData.max_distance) <= 0;
  const isDeadlineInvalid = parseFloat(formData.deadline) <= 0;
  const isFormValid = !isSocInvalid && !isDistanceInvalid && !isDeadlineInvalid;

  // Live Problem Formulation Fetch
  useEffect(() => {
    let isCancelled = false;
    const updateFormulation = async () => {
      if (isSocInvalid || isDistanceInvalid) return;
      setFormulationLoading(true);
      try {
        const payload = {
          ev_id: formData.ev_id,
          origin_node_id: "WAYPOINT-NORTH",
          destination_node_id: "CS-METRO",
          destination_area_name: formData.area,
          current_location: { x: parseFloat(formData.x0) || 0, y: parseFloat(formData.y0) || 0 },
          destination_location: { x: parseFloat(formData.xd) || 10, y: parseFloat(formData.yd) || 10 },
          battery_capacity_kwh: parseFloat(formData.capacity) || 60.0,
          current_charge_pct: parseFloat(formData.current_soc) || 18.0,
          required_charge_pct: parseFloat(formData.target_soc) || 80.0,
          departure_deadline_min: parseInt(formData.deadline) || 90,
          priority: formData.priority,
          is_emergency: formData.priority === 'EMERGENCY',
          connector_requirement: formData.connector,
          selected_search_algorithm: formData.algorithm
        };
        const res = await formulateProblem(payload);
        if (!isCancelled && res?.tuple) {
          setBackendFormulation(res);
        }
      } catch (err) {
        console.warn('Backend formulation sync:', err.message);
      } finally {
        if (!isCancelled) setFormulationLoading(false);
      }
    };

    const timer = setTimeout(updateFormulation, 250);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [formData, isSocInvalid, isDistanceInvalid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setError(null);

    const payload = {
      ev_id: formData.ev_id,
      current_location: { x: parseFloat(formData.x0), y: parseFloat(formData.y0) },
      destination: { x: parseFloat(formData.xd), y: parseFloat(formData.yd) },
      destination_area_name: formData.area,
      battery_capacity_kwh: parseFloat(formData.capacity),
      current_charge_pct: parseFloat(formData.current_soc),
      required_charge_pct: parseFloat(formData.target_soc),
      max_acceptable_distance_km: parseFloat(formData.max_distance),
      departure_deadline_min: parseFloat(formData.deadline),
      priority: formData.priority,
      connector_requirement: formData.connector,
      selected_search_algorithm: formData.algorithm
    };

    try {
      const data = await executePrimaryWorkflow(payload);
      setResult(data);
      if (onWorkflowExecuted) onWorkflowExecuted(data);
    } catch (err) {
      console.error('Workflow execution error:', err);
      setError(err.message || 'Failed to execute decision pipeline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derive mathematical problem formulation values live
  const deltaSOC = Math.max(0, formData.target_soc - formData.current_soc);
  const energyNeededKWh = ((deltaSOC / 100) * formData.capacity).toFixed(1);
  const euclideanDist = Math.hypot(formData.xd - formData.x0, formData.yd - formData.y0).toFixed(2);

  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div className="ai-card p-5 bg-gradient-to-r from-blue-50/40 via-white to-slate-50 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-blue">STEP 1 & 2 OF DECISION PIPELINE</span>
              <span className="text-xs text-slate-500 font-mono">FORMAL PROBLEM FORMULATION</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              EV Charging Request & State-Space Formulation
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Enter vehicle telematics parameters to formulate the formal Russell &amp; Norvig AI tuple 
              $\langle S, s_0, A, G, C, c \rangle$ and trigger classical AI reasoning.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            {Object.keys(presets).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleApplyPreset(key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                  activePreset === key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {presets[key].name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 Cols): Clean Request Form */}
        <div className="lg:col-span-7 space-y-4">
          <form onSubmit={handleSubmit} className="ai-card p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Vehicle Telematics Parameters</h3>
              </div>
              <span className="text-xs font-mono text-slate-500">{formData.ev_id}</span>
            </div>

            {/* Origin & Destination Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Current Location (x, y)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.x0}
                    onChange={(e) => handleChange('x0', e.target.value)}
                    className="form-input"
                    placeholder="x"
                    required
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={formData.y0}
                    onChange={(e) => handleChange('y0', e.target.value)}
                    className="form-input"
                    placeholder="y"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Destination Coordinates (x, y)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.xd}
                    onChange={(e) => handleChange('xd', e.target.value)}
                    className="form-input"
                    placeholder="x"
                    required
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={formData.yd}
                    onChange={(e) => handleChange('yd', e.target.value)}
                    className="form-input"
                    placeholder="y"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Destination Area */}
            <div>
              <label className="form-label">Destination Area / Campus Name</label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) => handleChange('area', e.target.value)}
                className="form-input"
                placeholder="e.g. Whitefield Tech Hub"
                required
              />
            </div>

            {/* Battery & SOC Parameters */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">Capacity (kWh)</label>
                <input
                  type="number"
                  step="1"
                  min="20"
                  max="120"
                  value={formData.capacity}
                  onChange={(e) => handleChange('capacity', e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Current SOC (%)</label>
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="90"
                  value={formData.current_soc}
                  onChange={(e) => handleChange('current_soc', e.target.value)}
                  className={`form-input ${formData.current_soc < 20 ? 'border-rose-300 bg-rose-50/30' : ''}`}
                  required
                />
              </div>

              <div>
                <label className="form-label">Target SOC (%)</label>
                <input
                  type="number"
                  step="1"
                  min="50"
                  max="100"
                  value={formData.target_soc}
                  onChange={(e) => handleChange('target_soc', e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Constraints: Max Distance & Deadline */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Max Search Radius (km)</label>
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="50"
                  value={formData.max_distance}
                  onChange={(e) => handleChange('max_distance', e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Departure Deadline (min)</label>
                <input
                  type="number"
                  step="5"
                  min="20"
                  max="240"
                  value={formData.deadline}
                  onChange={(e) => handleChange('deadline', e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Priority, Connector & Search Algorithm */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">Priority Class</label>
                <select
                  value={formData.priority}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  className="form-input"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="HIGH">High Priority</option>
                  <option value="EMERGENCY">Emergency Transport</option>
                </select>
              </div>

              <div>
                <label className="form-label">Connector Standard</label>
                <select
                  value={formData.connector}
                  onChange={(e) => handleChange('connector', e.target.value)}
                  className="form-input"
                >
                  <option value="CCS2">CCS2 (DC Fast)</option>
                  <option value="Type 2">Type 2 (AC Normal)</option>
                  <option value="CHAdeMO">CHAdeMO</option>
                </select>
              </div>

              <div>
                <label className="form-label">Search Algorithm</label>
                <select
                  value={formData.algorithm}
                  onChange={(e) => handleChange('algorithm', e.target.value)}
                  className="form-input"
                >
                  <option value="A*">A* Search (Optimal)</option>
                  <option value="Uniform Cost Search (UCS)">UCS (Dijkstra)</option>
                  <option value="Greedy Best-First Search (GBFS)">Greedy Best-First</option>
                  <option value="Breadth-First Search (BFS)">Breadth-First Search</option>
                  <option value="Depth-First Search (DFS)">Depth-First Search</option>
                </select>
              </div>
            </div>

            {/* Validation Alerts */}
            {isSocInvalid && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Invalid Battery State:</strong> Target SOC ({formData.target_soc}%) must be strictly greater than Current SOC ({formData.current_soc}%).
                </span>
              </div>
            )}

            {isDistanceInvalid && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Invalid Range:</strong> Search radius must be greater than 0 km.
                </span>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-mono">
                  $\Delta E = {energyNeededKWh}\text{ kWh}$ needed
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-secondary text-xs flex items-center gap-1.5 cursor-pointer py-1.5"
                  title="Reset parameters to scenario defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className={`btn-primary text-xs flex items-center gap-2 shadow-xs cursor-pointer ${
                  !isFormValid ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Formulating &amp; Executing AI Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Formulate &amp; Run AI Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column (5 Cols): Live Problem Formulation Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="ai-card p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Formal Problem Formulation</h3>
              </div>
              {formulationLoading ? (
                <span className="text-[10px] text-blue-600 font-mono animate-pulse">Syncing Tuple...</span>
              ) : backendFormulation?.tuple ? (
                <span className="badge-emerald text-[10px]">Verified Tuple</span>
              ) : (
                <span className="badge-slate text-[10px]">Tuple Preview</span>
              )}
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <span className="font-bold text-slate-900 block font-mono text-sm mb-1">
                  &lang;S, s₀, A, G, C, c&rang;
                </span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Russell &amp; Norvig 6-tuple definition governing state transitions and goal conditions.
                </p>
              </div>

              {/* Initial State */}
              <div className="p-3 border border-slate-200 rounded-md bg-white">
                <strong className="text-slate-700 block text-[11px] uppercase tracking-wider mb-1">
                  Initial State (s₀)
                </strong>
                <p className="font-mono text-slate-900 text-xs break-all">
                  {backendFormulation?.tuple?.initial_state_s0 || (
                    `⟨Loc=(${formData.x0}, ${formData.y0}), SOC=${formData.current_soc}%, Status=EnRoute⟩`
                  )}
                </p>
              </div>

              {/* Goal State */}
              <div className="p-3 border border-slate-200 rounded-md bg-white">
                <strong className="text-slate-700 block text-[11px] uppercase tracking-wider mb-1">
                  Goal Condition Test G(s)
                </strong>
                <p className="font-mono text-slate-900 text-xs break-all">
                  {backendFormulation?.tuple?.goal_test_G || (
                    `SOC(s) ≥ ${formData.target_soc}% ∧ dist(s, dest) ≤ 0.5km ∧ time(s) ≤ ${formData.deadline}m`
                  )}
                </p>
              </div>

              {/* Actions Space */}
              <div className="p-3 border border-slate-200 rounded-md bg-white">
                <strong className="text-slate-700 block text-[11px] uppercase tracking-wider mb-1">
                  Action Space A(s)
                </strong>
                <p className="font-mono text-slate-900 text-xs">
                  {Array.isArray(backendFormulation?.tuple?.action_space_A) ? (
                    `A = { ${backendFormulation.tuple.action_space_A.join(', ')} }`
                  ) : (
                    'A = { Travel(s, s\'), Queue(s), Charge(bay, Δt), Depart(s) }'
                  )}
                </p>
              </div>

              {/* Cost Function */}
              <div className="p-3 border border-slate-200 rounded-md bg-white">
                <strong className="text-slate-700 block text-[11px] uppercase tracking-wider mb-1">
                  Path Cost Function c(s, a, s')
                </strong>
                <p className="font-mono text-slate-900 text-xs">
                  {backendFormulation?.tuple?.step_cost_function_c || (
                    'c = w₁·dist(km) + w₂·t_wait(min) + w₃·tariff($/kWh)'
                  )}
                </p>
              </div>

              {/* Admissible Heuristic */}
              <div className="p-3 border border-slate-200 rounded-md bg-white">
                <strong className="text-slate-700 block text-[11px] uppercase tracking-wider mb-1">
                  Admissible Heuristic h(n)
                </strong>
                <p className="font-mono text-slate-900 text-xs">
                  {backendFormulation?.tuple?.admissible_heuristic_h || (
                    'h(n) = EuclideanDist(n, Goal) / v_max ≤ h*(n)'
                  )}
                </p>
              </div>

              {/* Constraints */}
              <div className="p-3 border border-slate-200 rounded-md bg-white">
                <strong className="text-slate-700 block text-[11px] uppercase tracking-wider mb-1">
                  Operational Constraints (C)
                  {backendFormulation?.tuple?.hard_constraints_count && (
                    <span className="text-[10px] text-blue-600 font-normal ml-2 font-mono">
                      ({backendFormulation.tuple.hard_constraints_count} active)
                    </span>
                  )}
                </strong>
                <ul className="text-slate-600 list-disc list-inside space-y-0.5 text-[11px]">
                  <li>Non-overlapping bay reservations: $\forall b, [t_1, t_2) \cap [t_3, t_4) = \emptyset$</li>
                  <li>Connector compatibility: Plug(EV) = Socket(Bay)</li>
                  <li>Substation headroom limit: concurrent load &le; 320 kW</li>
                </ul>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Execution Results Notification Banner */}
      {result && (
        <div className="ai-card p-5 border-emerald-200 bg-emerald-50/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  AI Decision Pipeline Executed Successfully for {result.step1_request?.ev_id}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Assigned Station: <strong>{result.step7_final_decision?.recommended_station_name}</strong> • 
                  Bay {result.step7_final_decision?.assigned_bay_id} • 
                  Slot {result.step7_final_decision?.recommended_time_slot} • 
                  Algorithm: {result.step4_search_comparison?.algorithm_chosen}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onSelectTab('search_comparison')}
                className="btn-secondary text-xs"
              >
                Inspect Search Comparison
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('explanation')}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <span>View Full Decision Trace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
          <strong>Pipeline Error:</strong> {error}
        </div>
      )}

    </div>
  );
}
