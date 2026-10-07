import React, { useState, useEffect, useCallback } from 'react';
import {
  Car,
  Zap,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Play,
  RotateCcw,
  GitCompare,
  Battery,
  Grid3x3
} from 'lucide-react';
import { PageHeader, Section, StatTile, StateBlock } from '../common';
import { listRecentExplanations } from '../../services/api';

const SEVERITY_BADGE = {
  CRITICAL: 'badge-rose',
  HIGH: 'badge-amber',
  MEDIUM: 'badge-blue',
  LOW: 'badge-slate'
};

function badgeForPriority(value) {
  const key = String(value || '').toUpperCase();
  return SEVERITY_BADGE[key] || 'badge-slate';
}

/**
 * The explanation registry stores the selected decision as a free-form object. Only its scalar
 * entries are shown; nested structures are summarised by size so no raw JSON reaches the table.
 */
function summariseDecision(decision) {
  if (!decision || typeof decision !== 'object') return '—';
  const preferred = ['decision', 'selected_station_id', 'station_id', 'charger_id', 'algorithm', 'action', 'is_feasible'];
  const entries = Object.entries(decision).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return '—';
  return [
    ...entries.filter(([k]) => preferred.includes(k)),
    ...entries.filter(([k]) => !preferred.includes(k)),
  ]
    .slice(0, 3)
    .map(([k, v]) => {
      if (typeof v === 'object') {
        return `${k}: ${Array.isArray(v) ? `${v.length} item(s)` : `${Object.keys(v).length} field(s)`}`;
      }
      if (typeof v === 'number') return `${k}: ${Number.isInteger(v) ? v : v.toFixed(2)}`;
      return `${k}: ${String(v).slice(0, 40)}`;
    })
    .join(' · ');
}

export default function DashboardView({
  simState,
  onSelectTab,
  onStepSimulation,
  onResetSimulation
}) {
  const [decisions, setDecisions] = useState([]);
  const [decisionsState, setDecisionsState] = useState('loading');
  const [decisionsError, setDecisionsError] = useState(null);
  const [busy, setBusy] = useState(null);

  const evs = simState?.evs || [];
  const stations = simState?.stations || [];
  const sessions = simState?.sessions || [];
  const resources = simState?.energy_resources || [];
  const metrics = simState?.peas_metrics || {};
  const grid = simState?.grid_node;

  // Vehicle statuses are QUEUED / CHARGING / COMPLETED / TIMED_OUT / CANCELLED.
  const chargingEVs = evs.filter((e) => e.status === 'CHARGING');
  const waitingEVs = evs.filter((e) => e.status === 'QUEUED');
  const completedEVs = evs.filter((e) => e.status === 'COMPLETED');
  const activeEVs = evs.filter((e) => e.status === 'QUEUED' || e.status === 'CHARGING');
  const availableStations = stations.filter((s) => s.operating_status === 'OPERATIONAL');
  const faultStations = stations.filter((s) => s.operating_status === 'FAULT');
  // Bay counts are derived from the charger records, which is the same source the
  // scheduler reads. The API does not report a separate bay-total field.
  const allChargers = stations.flatMap((s) => s.chargers || []);
  const totalBays = allChargers.length;
  const freeBays = allChargers.filter((c) => c.current_status === 'AVAILABLE').length;

  const loadDecisions = useCallback(async () => {
    try {
      const records = await listRecentExplanations(6);
      setDecisions(Array.isArray(records) ? records : []);
      setDecisionsState('ready');
      setDecisionsError(null);
    } catch (err) {
      setDecisions([]);
      setDecisionsState('error');
      setDecisionsError(err.message);
    }
  }, []);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  const runAction = async (name, fn) => {
    setBusy(name);
    try {
      await fn();
      await loadDecisions();
    } finally {
      setBusy(null);
    }
  };

  const gridLoad = grid?.current_load ?? grid?.currentLoad;
  const gridCap = grid?.maximum_capacity ?? grid?.maximumCapacity;
  const gridPct =
    typeof gridLoad === 'number' && typeof gridCap === 'number' && gridCap > 0
      ? Math.round((gridLoad / gridCap) * 100)
      : null;

  return (
    <div className="page">

      <PageHeader
        eyebrow="Overview"
        title="EV Charging & Resource Management Dashboard"
        description="Real-time monitoring of fleet status, charging station availability, grid transformer load, and scheduled sessions."
        actions={
          <>
            <button
              type="button"
              onClick={() => onSelectTab('ev_request')}
              className="btn-primary"
            >
              <Car className="h-4 w-4" />
              Submit EV request
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('explanation')}
              className="btn-secondary"
            >
              Explain latest decision
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        }
      />

      {/* Fleet + network metrics */}
      <div className="stat-grid">
        <StatTile
          label="Active EV requests"
          value={activeEVs.length}
          unit="vehicles"
          hint={`${chargingEVs.length} charging · ${waitingEVs.length} queued · ${completedEVs.length} completed`}
        />
        <StatTile
          label="Stations available"
          value={`${availableStations.length}/${stations.length}`}
          tone="success"
          hint={`${freeBays} of ${totalBays} charging bays free`}
        />
        <StatTile
          label="Sessions scheduled"
          value={sessions.length}
          hint={
            sessions.length === 0
              ? 'No charging session created yet'
              : 'Assignments produced by the search + CSP pipeline'
          }
        />
        <StatTile
          label="Faulted stations"
          value={faultStations.length}
          tone={faultStations.length > 0 ? 'danger' : 'muted'}
          hint={
            faultStations.length > 0
              ? 'Rerouting is applied to these stations'
              : 'All stations reported operational'
          }
        />
      </div>

      {/* Grid + resource position */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        <Section
          title="Grid transformer"
          description="Live load reported by the simulated grid node."
          className="lg:col-span-1"
        >
          {grid ? (
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-slate-900">
                  {typeof gridLoad === 'number' ? gridLoad.toFixed(1) : 'n/a'}
                </span>
                <span className="text-sm font-semibold text-slate-500">
                  / {typeof gridCap === 'number' ? gridCap.toFixed(0) : 'n/a'} kW
                </span>
              </div>

              {gridPct !== null && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-2xs text-slate-500">
                    <span>Utilisation</span>
                    <span className="font-mono font-semibold text-slate-700">{gridPct}%</span>
                  </div>
                  <div className="bar">
                    <div
                      className={`bar__fill ${
                        gridPct >= 90
                          ? 'bg-rose-500'
                          : gridPct >= 70
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, gridPct)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
                <span className="text-slate-500">Node status</span>
                <span className={grid.status === 'STABLE' ? 'badge-emerald' : 'badge-amber'}>
                  {grid.status || 'UNKNOWN'}
                </span>
              </div>
              {metrics.grid_overload_incidents !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Overload incidents</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {metrics.grid_overload_incidents}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <StateBlock
              variant="info"
              title="Grid state unavailable"
              detail="The simulation state could not be loaded from the backend."
            />
          )}
        </Section>

        <Section
          title="Energy resources"
          description="Availability and tariff of every supplied energy source."
          className="lg:col-span-2"
        >
          {resources.length === 0 ? (
            <StateBlock
              variant="empty"
              title="No energy resources reported"
              detail="Start the backend and step the simulation to populate this table."
            />
          ) : (
            <div className="ai-table-container">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Type</th>
                    <th className="num">Available power</th>
                    <th className="num">Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.id}>
                      <td className="col-code">{r.id}</td>
                      <td>{r.type}</td>
                      <td className="num">
                        {typeof r.available_power === 'number' ? `${r.available_power.toFixed(1)} kW` : '—'}
                      </td>
                      <td className="num">
                        {typeof r.cost === 'number' ? `$${r.cost.toFixed(3)}/kWh` : '—'}
                      </td>
                      <td>
                        <span
                          className={
                            r.availability_status === 'AVAILABLE'
                              ? 'badge-emerald'
                              : r.availability_status === 'LIMITED'
                                ? 'badge-amber'
                                : 'badge-slate'
                          }
                        >
                          {r.availability_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

      </div>

      {/* Recent recorded decisions - read from the backend explanation registry */}
      <Section
        title="Recent decisions recorded by the engine"
        description="Every entry below was written by a real backend run. Nothing on this page is precomputed or hardcoded."
        actions={
          <>
            <button
              type="button"
              onClick={() => runAction('step', onStepSimulation)}
              disabled={busy !== null}
              className="btn-secondary btn-sm"
            >
              <Play className="h-3.5 w-3.5" />
              {busy === 'step' ? 'Stepping…' : 'Step simulation'}
            </button>
            <button
              type="button"
              onClick={() => runAction('reset', onResetSimulation)}
              disabled={busy !== null}
              className="btn-secondary btn-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {busy === 'reset' ? 'Resetting…' : 'Reset'}
            </button>
          </>
        }
      >
        {decisionsState === 'loading' ? (
          <StateBlock variant="loading" title="Loading decision records" />
        ) : decisionsState === 'error' ? (
          <StateBlock
            variant="error"
            title="Decision registry unavailable"
            detail={decisionsError}
            action={
              <button type="button" onClick={loadDecisions} className="btn-secondary btn-sm">
                Retry
              </button>
            }
          />
        ) : decisions.length === 0 ? (
          <StateBlock
            variant="empty"
            title="No decision has been recorded yet"
            detail="Run a request from the EV Request page, or solve a CSP / search scenario, and the resulting decision will appear here."
            action={
              <button
                type="button"
                onClick={() => onSelectTab('ev_request')}
                className="btn-primary btn-sm"
              >
                Open EV request
              </button>
            }
          />
        ) : (
          <div className="ai-table-container">
            <table className="ai-table">
              <thead>
                <tr>
                  <th>Decision ID</th>
                  <th>Topic</th>
                  <th>Algorithm</th>
                  <th>Selected decision</th>
                  <th>Recorded at</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={d.decision_id}>
                    <td className="col-code">{d.decision_id}</td>
                    <td>
                      <span className="badge-blue">{d.topic}</span>
                    </td>
                    <td className="font-medium text-slate-700">{d.algorithm_used}</td>
                    <td className="text-slate-600">{summariseDecision(d.selected_decision)}</td>
                    <td className="col-code">
                      {d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Guided next steps through the pipeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <Section
          title="Fleet snapshot"
          description="Current status of every vehicle the engine is tracking."
        >
          {evs.length === 0 ? (
            <StateBlock
              variant="empty"
              title="No vehicles in the network"
              detail="Submit a request from the EV Request page to add a vehicle."
            />
          ) : (
            <div className="ai-table-container">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th className="num">Battery</th>
                    <th>Assigned station</th>
                  </tr>
                </thead>
                <tbody>
                  {evs.map((ev) => (
                    <tr key={ev.id}>
                      <td className="col-code">{ev.id}</td>
                      <td>
                        <span className={badgeForPriority(ev.priority)}>{ev.priority}</span>
                      </td>
                      <td>{ev.status}</td>
                      <td className="num">
                        {ev.current_battery_level !== undefined
                          ? `${Number(ev.current_battery_level).toFixed(0)}%`
                          : '—'}
                      </td>
                      <td className="col-code">{ev.assigned_station_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          title="Operational Workspaces"
          description="Direct access to search, scheduling, rule verification, and conflict arbitration modules."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                id: 'station_search',
                icon: Zap,
                title: 'Station search',
                text: 'Compare BFS, DFS, UCS, greedy and A* over the charging network.'
              },
              {
                id: 'search_comparison',
                icon: GitCompare,
                title: 'Search comparison',
                text: 'See path cost, nodes expanded, runtime and the chosen route per algorithm.'
              },
              {
                id: 'scheduling',
                icon: Calendar,
                title: 'CSP scheduling',
                text: 'Assign vehicles to chargers and time slots under hard constraints.'
              },
              {
                id: 'conflict_decision',
                icon: AlertTriangle,
                title: 'Conflict decision',
                text: 'Resolve competition for the same slot using a game-theoretic rule.'
              },
              {
                id: 'knowledge_logic',
                icon: Battery,
                title: 'Knowledge & logic',
                text: 'Inspect the fact base and follow forward/backward inference chains.'
              },
              {
                id: 'evaluation',
                icon: Grid3x3,
                title: 'Evaluation',
                text: 'Measured results of four dispatch policies over a seeded fleet run.'
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className="group flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-900">{item.title}</span>
                    <span className="mt-0.5 block text-2xs leading-relaxed text-slate-500">
                      {item.text}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

      </div>

      {/* Measured headline results */}
      {(metrics.total_evs_processed > 0 || metrics.total_energy_delivered_kwh > 0) && (
        <Section
          title="Cumulative run metrics"
          description="Counters maintained by the simulation engine for the current run."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile
              label="EVs processed"
              value={metrics.total_evs_processed ?? 0}
              size="sm"
            />
            <StatTile label="Completed" value={metrics.completed_evs ?? 0} size="sm" tone="success" />
            <StatTile
              label="Timed out"
              value={metrics.timed_out_evs ?? 0}
              size="sm"
              tone={metrics.timed_out_evs > 0 ? 'danger' : 'muted'}
            />
            <StatTile
              label="Average wait"
              value={Number(metrics.average_wait_time_min ?? 0).toFixed(1)}
              unit="min"
              size="sm"
            />
            <StatTile
              label="Energy delivered"
              value={Number(metrics.total_energy_delivered_kwh ?? 0).toFixed(1)}
              unit="kWh"
              size="sm"
              tone="primary"
            />
            <StatTile
              label="Grid overloads"
              value={metrics.grid_overload_incidents ?? 0}
              size="sm"
              tone={metrics.grid_overload_incidents > 0 ? 'danger' : 'muted'}
            />
          </div>
        </Section>
      )}

    </div>
  );
}
