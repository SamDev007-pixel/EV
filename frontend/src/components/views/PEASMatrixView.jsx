import React, { useEffect, useState } from 'react';
import { Target, Layers, Sliders, Activity, RefreshCw, Loader2, Cpu } from 'lucide-react';
import { fetchPEAS } from '../../services/api';
import { Banner, KeyValueGrid, StatTile, StateBlock } from '../common';

const QUADRANTS = [
  { key: 'performance_measure', label: 'Performance Measure (P)', icon: Target, tone: 'text-blue-700' },
  { key: 'environment', label: 'Environment (E)', icon: Layers, tone: 'text-slate-800' },
  { key: 'actuators', label: 'Actuators (A)', icon: Sliders, tone: 'text-teal-700' },
  { key: 'sensors', label: 'Sensors / Inputs (S)', icon: Activity, tone: 'text-indigo-700' },
];

/**
 * PEAS panel.
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
    <div className="ai-card section space-y-4">
      <div className="section-head">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
            <Cpu className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="section-title">
              PEAS specification{spec?.agent_name ? ` — ${spec.agent_name}` : ''}
            </h3>
            <p className="section-desc">
              What the agent perceives, how it acts, what it is measured on, and the environment it
              operates in.
            </p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={loading} className="btn-secondary btn-sm">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <Banner variant="error" action={<button type="button" onClick={load} className="btn-secondary btn-sm">Retry</button>}>
          {error}
        </Banner>
      )}

      {loading && !spec && <StateBlock variant="loading" title="Loading PEAS specification…" />}

      {spec && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {QUADRANTS.map(({ key, label, icon: Icon, tone }) => (
              <div key={key} className="ai-card-flat space-y-2">
                <div className={`flex items-center gap-2 text-xs font-semibold ${tone}`}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </div>
                <ul className="space-y-1.5 text-xs leading-relaxed text-slate-700">
                  {(spec[key] || []).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {metrics && (
            <div>
              <span className="kv-term">Measured performance counters (live simulation)</span>
              <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  ['EVs processed', metrics.total_evs_processed],
                  ['Completed', metrics.completed_evs],
                  ['Timed out', metrics.timed_out_evs],
                  ['Average wait', metrics.average_wait_time_min, 'min'],
                  ['Grid overloads', metrics.grid_overload_incidents],
                  ['Peak grid load', metrics.peak_grid_load_kw, 'kW'],
                  ['Charger utilisation', metrics.station_avg_utilization_pct, '%'],
                  ['Emergency served', metrics.emergency_evs_serviced],
                  ['Energy delivered', metrics.total_energy_delivered_kwh, 'kWh'],
                  ['Solar used', metrics.solar_utilized_kwh, 'kWh']
                ].map(([label, value, unit]) => (
                  <StatTile key={label} label={label} value={value} unit={unit} size="sm" />
                ))}
              </div>
            </div>
          )}

          {classification && (
            <div className="space-y-2">
              <span className="kv-term">Environment classification</span>
              <KeyValueGrid
                columns={2}
                items={Object.entries(classification).map(([k, v]) => ({
                  term: k.replace(/_/g, ' '),
                  value: String(v),
                }))}
              />
            </div>
          )}

          {provenance && (
            <div className="space-y-2">
              <span className="kv-term">Data provenance</span>
              <KeyValueGrid
                columns={2}
                items={Object.entries(provenance).map(([k, v]) => ({
                  term: k.replace(/_/g, ' '),
                  value: String(v),
                }))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
