import React, { useState, useEffect } from 'react';
import {
  Send,
  RotateCcw,
  ArrowRight,
  Calculator,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { executePrimaryWorkflow, formulateProblem } from '../../services/api';
import { PageHeader, Section, StatTile, StateBlock, Banner } from '../common';

const PRESETS = {
  commuter: {
    name: 'Commuter rush',
    desc: 'Urban commuter with a depleted battery needing a fast top-up before the morning commute.',
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
    name: 'Emergency vehicle',
    desc: 'Critical transport vehicle needing a guaranteed bay with a battery reserve under 20%.',
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
    name: 'Highway transit',
    desc: 'Long-distance courier requiring a high-capacity top-up along the expressway corridor.',
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

/** Formats a scalar for display: numbers are trimmed, everything else is stringified. */
function formatTupleScalar(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Renders one element of the formulated tuple. The backend returns a mix of plain
 * strings and structured objects (the initial state is a mapping), so objects are
 * displayed as an aligned list rather than raw text.
 */
function TupleValue({ value }) {
  if (value === null || value === undefined || value === '') {
    return <p className="mt-1 font-mono text-xs text-slate-400">—</p>;
  }

  if (Array.isArray(value)) {
    return (
      <ul className="mt-1 space-y-1">
        {value.map((item, i) => (
          <li key={i} className="break-words font-mono text-xs text-slate-800">
            {formatTupleScalar(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object') {
    return (
      <dl className="kv-grid mt-1.5">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="kv-term">{k.replace(/_/g, ' ')}</dt>
            <dd className="kv-value font-mono">{formatTupleScalar(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return <p className="mt-1 break-words font-mono text-xs text-slate-900">{String(value)}</p>;
}

export default function EVRequestView({ onSelectTab, onWorkflowExecuted }) {
  const [activePreset, setActivePreset] = useState('commuter');
  const [formData, setFormData] = useState({ ...PRESETS.commuter });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Problem formulation returned by the backend for the current inputs.
  const [backendFormulation, setBackendFormulation] = useState(null);
  const [formulationLoading, setFormulationLoading] = useState(false);
  const [formulationError, setFormulationError] = useState(null);

  const handleApplyPreset = (key) => {
    setActivePreset(key);
    setFormData({ ...PRESETS[key] });
    setResult(null);
    setError(null);
  };

  const handleReset = () => {
    setActivePreset('commuter');
    setFormData({ ...PRESETS.commuter });
    setResult(null);
    setError(null);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isSocInvalid = parseFloat(formData.current_soc) >= parseFloat(formData.target_soc);
  const isDistanceInvalid = parseFloat(formData.max_distance) <= 0;
  const isDeadlineInvalid = parseFloat(formData.deadline) <= 0;
  const isFormValid = !isSocInvalid && !isDistanceInvalid && !isDeadlineInvalid;

  // Ask the backend to formulate the request whenever the inputs change.
  useEffect(() => {
    let isCancelled = false;

    const updateFormulation = async () => {
      if (isSocInvalid || isDistanceInvalid) return;
      setFormulationLoading(true);
      try {
        const payload = {
          ev_id: formData.ev_id,
          origin_node_id: 'WAYPOINT-NORTH',
          destination_node_id: 'CS-METRO',
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
          setFormulationError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          setBackendFormulation(null);
          setFormulationError(err.message || 'Problem formulation service unavailable.');
        }
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
      setError(err.message || 'The decision pipeline could not be executed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Values derived on the client from the user's own inputs. These are arithmetic,
  // not AI results, and are labelled as such.
  const deltaSOC = Math.max(0, parseFloat(formData.target_soc) - parseFloat(formData.current_soc));
  const energyNeededKWh = ((deltaSOC / 100) * parseFloat(formData.capacity || 0)).toFixed(1);
  const straightLineKm = Math.hypot(
    parseFloat(formData.xd) - parseFloat(formData.x0),
    parseFloat(formData.yd) - parseFloat(formData.y0)
  ).toFixed(2);

  const tuple = backendFormulation?.tuple;

  return (
    <div className="page">

      <PageHeader
        eyebrow="Request Management"
        title="EV Charging Request & Problem Formulation"
        description="Enter vehicle specifications and charging requirements to configure route planning and scheduling parameters."
        meta={
          activePreset && (
            <span className="badge-slate normal-case">Sample request: {PRESETS[activePreset].name}</span>
          )
        }
        actions={
          <div className="tabs" role="tablist" aria-label="Sample requests">
            {Object.keys(PRESETS).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activePreset === key}
                onClick={() => handleApplyPreset(key)}
                className="tab"
              >
                {PRESETS[key].name}
              </button>
            ))}
          </div>
        }
      />

      <p className="-mt-2 text-xs leading-relaxed text-slate-500">
        {PRESETS[activePreset].desc}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* Request form */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="ai-card section">
            <div className="section-head">
              <div>
                <h2 className="section-title">
                  <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                  Request parameters
                </h2>
                <p className="section-desc">
                  Field values are sent to the backend; nothing is inferred on the client.
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500">{formData.ev_id}</span>
            </div>

            <div className="space-y-5">
              {/* Coordinates */}
              <div className="form-grid">
                <div>
                  <label className="form-label" htmlFor="x0">Current location x</label>
                  <input
                    id="x0"
                    type="number"
                    step="0.1"
                    value={formData.x0}
                    onChange={(e) => handleChange('x0', e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="y0">Current location y</label>
                  <input
                    id="y0"
                    type="number"
                    step="0.1"
                    value={formData.y0}
                    onChange={(e) => handleChange('y0', e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div className="hidden lg:block" />
                <div>
                  <label className="form-label" htmlFor="xd">Destination x</label>
                  <input
                    id="xd"
                    type="number"
                    step="0.1"
                    value={formData.xd}
                    onChange={(e) => handleChange('xd', e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="yd">Destination y</label>
                  <input
                    id="yd"
                    type="number"
                    step="0.1"
                    value={formData.yd}
                    onChange={(e) => handleChange('yd', e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="form-label" htmlFor="area">Destination area</label>
                  <input
                    id="area"
                    type="text"
                    value={formData.area}
                    onChange={(e) => handleChange('area', e.target.value)}
                    className="form-input"
                    placeholder="e.g. Whitefield Tech Hub"
                    required
                  />
                </div>
              </div>

              <div className="border-t border-slate-200" />

              {/* Battery */}
              <div className="form-grid">
                <div>
                  <label className="form-label" htmlFor="capacity">Battery capacity (kWh)</label>
                  <input
                    id="capacity"
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
                  <label className="form-label" htmlFor="current_soc">Current SOC (%)</label>
                  <input
                    id="current_soc"
                    type="number"
                    step="1"
                    min="5"
                    max="90"
                    value={formData.current_soc}
                    onChange={(e) => handleChange('current_soc', e.target.value)}
                    className={`form-input ${
                      parseFloat(formData.current_soc) < 20 ? 'border-rose-300' : ''
                    }`}
                    required
                  />
                  <p className="form-hint">Below 20% is treated as a low-battery condition.</p>
                </div>
                <div>
                  <label className="form-label" htmlFor="target_soc">Target SOC (%)</label>
                  <input
                    id="target_soc"
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

              <div className="border-t border-slate-200" />

              {/* Constraints */}
              <div className="form-grid">
                <div>
                  <label className="form-label" htmlFor="max_distance">Max search radius (km)</label>
                  <input
                    id="max_distance"
                    type="number"
                    step="1"
                    min="5"
                    max="50"
                    value={formData.max_distance}
                    onChange={(e) => handleChange('max_distance', e.target.value)}
                    className="form-input"
                    required
                  />
                  <p className="form-hint">Stations beyond this distance are excluded from the search.</p>
                </div>
                <div>
                  <label className="form-label" htmlFor="deadline">Departure deadline (min)</label>
                  <input
                    id="deadline"
                    type="number"
                    step="5"
                    min="20"
                    max="240"
                    value={formData.deadline}
                    onChange={(e) => handleChange('deadline', e.target.value)}
                    className="form-input"
                    required
                  />
                  <p className="form-hint">Hard constraint used by the scheduler.</p>
                </div>
                <div>
                  <label className="form-label" htmlFor="priority">Priority class</label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    className="form-input"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="HIGH">High priority</option>
                    <option value="EMERGENCY">Emergency transport</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="connector">Connector standard</label>
                  <select
                    id="connector"
                    value={formData.connector}
                    onChange={(e) => handleChange('connector', e.target.value)}
                    className="form-input"
                  >
                    <option value="CCS2">CCS2 (DC fast)</option>
                    <option value="Type 2">Type 2 (AC normal)</option>
                    <option value="CHAdeMO">CHAdeMO</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="algorithm">Search algorithm</label>
                  <select
                    id="algorithm"
                    value={formData.algorithm}
                    onChange={(e) => handleChange('algorithm', e.target.value)}
                    className="form-input"
                  >
                    <option value="A*">A* search</option>
                    <option value="Uniform Cost Search (UCS)">Uniform cost search</option>
                    <option value="Greedy Best-First Search (GBFS)">Greedy best-first</option>
                    <option value="Breadth-First Search (BFS)">Breadth-first search</option>
                    <option value="Depth-First Search (DFS)">Depth-first search</option>
                  </select>
                </div>
              </div>

              {isSocInvalid && (
                <Banner variant="error">
                  <strong>Invalid battery state.</strong> Target SOC ({formData.target_soc}%) must be
                  greater than current SOC ({formData.current_soc}%).
                </Banner>
              )}

              {isDistanceInvalid && (
                <Banner variant="warn">
                  <strong>Invalid search radius.</strong> The radius must be greater than 0 km.
                </Banner>
              )}

              {isDeadlineInvalid && (
                <Banner variant="warn">
                  <strong>Invalid deadline.</strong> The departure deadline must be greater than 0
                  minutes.
                </Banner>
              )}

              {/* Input-derived readouts */}
              <div className="stat-grid">
                <StatTile label="Energy required" value={energyNeededKWh} unit="kWh" size="sm" />
                <StatTile label="ΔSOC" value={deltaSOC.toFixed(0)} unit="%" size="sm" />
                <StatTile
                  label="Straight-line distance"
                  value={straightLineKm}
                  unit="km"
                  size="sm"
                  hint="Euclidean distance between the two input points"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={handleReset} className="btn-secondary">
                  <RotateCcw className="h-4 w-4" />
                  Reset to sample
                </button>

                <button type="submit" disabled={isSubmitting || !isFormValid} className="btn-primary">
                  {isSubmitting ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Running decision pipeline&hellip;
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Formulate and run pipeline
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Formulation preview */}
        <div className="lg:col-span-5">
          <Section
            title="Formal problem formulation"
            description="Returned by the backend for the values currently in the form."
            actions={
              formulationLoading ? (
                <span className="badge-slate">Formulating…</span>
              ) : tuple ? (
                <span className="badge-emerald">From backend</span>
              ) : (
                <span className="badge-slate">Not available</span>
              )
            }
          >
            {formulationError ? (
              <StateBlock
                variant="error"
                title="Formulation service unavailable"
                detail={formulationError}
              />
            ) : !tuple ? (
              <StateBlock
                variant="loading"
                title="Waiting for the backend"
                detail="The tuple below is generated by the problem-formulation module, not by the interface."
              />
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-mono text-sm font-bold text-slate-900">
                    &lang;S, s₀, A, G, C, c&rang;
                  </p>
                  <p className="mt-1 text-2xs leading-relaxed text-slate-600">
                    State space, initial state, action space, goal test, constraints and step cost
                    produced by the formulation module.
                  </p>
                </div>

                {[
                  ['Initial state s₀', tuple.initial_state_s0],
                  ['Goal test G(s)', tuple.goal_test_G],
                  ['Action space A(s)', tuple.action_space_A],
                  ['Step cost c(s, a, s\')', tuple.step_cost_function_c],
                  ['Heuristic h(n)', tuple.admissible_heuristic_h]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-slate-200 p-3">
                    <span className="kv-term">{label}</span>
                    <TupleValue value={value} />
                  </div>
                ))}

                {tuple.hard_constraints_count !== undefined && (
                  <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                    <span className="kv-term">Hard constraints</span>
                    <span className="badge-blue">{tuple.hard_constraints_count} active</span>
                  </div>
                )}

                <p className="flex items-start gap-1.5 text-2xs text-slate-500">
                  <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                  Constraint expressions come from the backend module that the solver actually uses,
                  so what you read here is what the algorithms run against.
                </p>
              </div>
            )}
          </Section>
        </div>

      </div>

      {result && (
        <Banner variant="ok">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong>
                Pipeline completed for {result.step1_request?.ev_id || formData.ev_id}
              </strong>
              <p className="mt-0.5 text-2xs leading-relaxed text-emerald-900/90">
                Selected station{' '}
                <strong>{result.step7_final_decision?.recommended_station_name || 'n/a'}</strong>
                {result.step7_final_decision?.assigned_bay_id
                  ? ` · bay ${result.step7_final_decision.assigned_bay_id}`
                  : ''}
                {result.step7_final_decision?.recommended_time_slot
                  ? ` · slot ${result.step7_final_decision.recommended_time_slot}`
                  : ''}
                {result.step4_search_comparison?.algorithm_chosen
                  ? ` · algorithm ${result.step4_search_comparison.algorithm_chosen}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectTab('search_comparison')}
                className="btn-secondary btn-sm"
              >
                Search comparison
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('explanation')}
                className="btn-primary btn-sm"
              >
                Decision trace
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </Banner>
      )}

      {error && (
        <Banner variant="error">
          <strong>Pipeline error.</strong> {error}
        </Banner>
      )}

      <Section
        title="What happens after you submit"
        description="The pipeline runs in a fixed order; each stage is visible on its own page."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Formulation', 'Inputs become an initial state, goal test, action space and cost function.'],
            ['Search', 'Five search algorithms run over the charging network and report their metrics.'],
            ['Scheduling', 'The scheduler assigns a charger and a time window under hard constraints.'],
            ['Decision', 'Conflicts are arbitrated, and the final plan is recorded with its explanation.']
          ].map(([title, text], i) => (
            <div key={title} className="rounded-md border border-slate-200 p-3">
              <span className="font-mono text-2xs text-slate-400">0{i + 1}</span>
              <p className="mt-0.5 text-xs font-bold text-slate-900">{title}</p>
              <p className="mt-1 text-2xs leading-relaxed text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-400">
        <Calculator className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          The energy, ΔSOC and straight-line distance tiles are plain arithmetic on the values you
          typed. Every other figure on this page is returned by the backend.
        </span>
      </p>

    </div>
  );
}
