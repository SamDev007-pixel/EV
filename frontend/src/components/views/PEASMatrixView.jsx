import React, { useEffect, useState } from 'react';
import { Target, Layers, Sliders, Activity, RefreshCw, Loader2, AlertCircle, Cpu } from 'lucide-react';
import { fetchPEAS } from '../../services/api';

const QUADRANTS = [
  { key: 'performance_measure', label: 'Performance Measure (P)', icon: Target, tone: 'text-blue-700' },
  { key: 'environment', label: 'Environment (E)', icon: Layers, tone: 'text-slate-800' },
  { key: 'actuators', label: 'Actuators (A)', icon: Sliders, tone: 'text-teal-700' },
  { key: 'sensors', label: 'Sensors / Inputs (S)', icon: Activity, tone: 'text-indigo-700' },
];

/**
 * PEAS panel (FOAI Unit I).
 *
 * The specification and the numbers shown here are fetched from GET /api/peas: the
 * specification is the agent description, and `measured_metrics` is read from the live
 * simulation counters (not from constants). The environment classification returned by the
 * same endpoint is rendered verbatim so the taxonomy is the backend's, not this component's.
 */
export default function PEASMatrixView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchPEAS());
    } catch (err) {
      setError(err.message || 'Unable to load the PEAS specification.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const spec = data?.specification;
  const metrics = data?.measured_metrics;
  const classification = data?.environment_classification;
  const provenance = data?.data_provenance;

  return (
    <div className="ai-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-50 border border-blue-200 text-blue-700 rounded-md flex items-center justify-center">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              PEAS Specification — {spec?.agent_name || 'agent'}
            </h3>
            <p className="text-xs text-slate-500">
              Unit I: the environment an intelligent agent is defined against, with the metrics the running system measures.
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-xs flex items-center gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !spec && (
        <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Loading PEAS specification…</span>
        </div>
      )}

      {spec && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {QUADRANTS.map(({ key, label, icon: Icon, tone }) => (
              <div key={key} className="border border-slate-200 rounded-md p-3.5 bg-slate-50/60">
                <div className={`flex items-center gap-2 font-bold text-xs mb-2 ${tone}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider">{label}</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {(spec[key] || []).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {metrics && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Measured performance counters (live simulation)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-center">
                {[
                  ['EVs processed', metrics.total_evs_processed],
                  ['Completed', metrics.completed_evs],
                  ['Timed out', metrics.timed_out_evs],
                  ['Avg wait (min)', metrics.average_wait_time_min],
                  ['Overload incidents', metrics.grid_overload_incidents],
                  ['Peak load (kW)', metrics.peak_grid_load_kw],
                  ['Charger util (%)', metrics.station_avg_utilization_pct],
                  ['Emergency served', metrics.emergency_evs_serviceed ?? metrics.emergency_evs_serviced],
                  ['Energy (kWh)', metrics.total_energy_delivered_kwh],
                  ['Solar used (kWh)', metrics.solar_utilized_kwh],
                ].map(([label, value]) => (
                  <div key={label} className="bg-slate-50 border border-slate-200 rounded-md py-2 px-1">
                    <div className="text-sm font-bold text-slate-900 font-mono">{value ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {classification && (
            <div className="border border-slate-200 rounded-md p-3.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Environment classification (backend taxonomy)
              </h4>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(classification).map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="font-semibold text-slate-600 uppercase text-[10px] tracking-wide">
                      {k.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-slate-700">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {provenance && (
            <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50/60">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Data provenance</h4>
              <ul className="space-y-1 text-xs text-slate-700">
                {Object.entries(provenance).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-semibold">{k.replace(/_/g, ' ')}: </span>
                    <span>{String(v)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
