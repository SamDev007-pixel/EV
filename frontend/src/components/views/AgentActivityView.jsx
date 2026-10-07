import React, { useState } from 'react';
import PEASMatrixView from './PEASMatrixView';
import { Terminal, RefreshCw, Search, Filter } from 'lucide-react';
import { PageHeader, Section, StateBlock } from '../common';

const ROLE_BADGE = {
  EV_AGENT: 'badge-blue',
  STATION_AGENT: 'badge-teal',
  COORDINATOR_AGENT: 'badge-emerald',
  GRID_AGENT: 'badge-amber',
  ENERGY_AGENT: 'badge-amber'
};


/**
 * Percepts are a mixed bag of scalars and whole environment structures. Scalars are shown
 * directly; collections are summarised by size so a single card cannot flood the page.
 */
function perceptSummary(percepts = {}) {
  return Object.entries(percepts)
    .slice(0, 8)
    .map(([key, value]) => {
      if (value === null || value === undefined) return [key, '—'];
      if (Array.isArray(value)) return [key, `${value.length} item(s)`];
      if (typeof value === 'object') {
        return [key, `${Object.keys(value).length} field(s)`];
      }
      if (typeof value === 'number') {
        return [key, Number.isInteger(value) ? String(value) : value.toFixed(2)];
      }
      return [key, String(value).slice(0, 40)];
    });
}

/** Agents are loaded from the running simulation, so the roster is never guessed. */
function AgentCard({ agent }) {
  const role = agent.role || 'AGENT';
  return (
    <div className="ai-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-sm font-bold text-slate-900">
            {agent.identity}
          </h3>
          <span className="mt-0.5 block text-2xs text-slate-500">
            {agent.log_count ?? 0} decisions recorded
          </span>
        </div>
        <span className={ROLE_BADGE[role] || 'badge-slate'}>
          {role.replace(/_/g, ' ')}
        </span>
      </div>

      {(agent.goals || []).length > 0 && (
        <div className="border-t border-slate-200 pt-2.5">
          <span className="kv-term">Goals</span>
          <ul className="mt-1 space-y-1">
            {agent.goals.map((goal) => (
              <li key={goal} className="text-2xs leading-relaxed text-slate-600">
                {goal}
              </li>
            ))}
          </ul>
        </div>
      )}

      {perceptSummary(agent.percepts).length > 0 && (
        <div className="border-t border-slate-200 pt-2.5">
          <span className="kv-term">Latest percepts</span>
          <ul className="mt-1 space-y-0.5">
            {perceptSummary(agent.percepts).map(([key, value]) => (
              <li key={key} className="flex items-baseline justify-between gap-2 text-2xs">
                <span className="truncate font-mono text-slate-500">{key}</span>
                <span className="shrink-0 font-mono font-medium text-slate-700">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AgentActivityView({ agents = [], logs = [], onRefresh }) {
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const term = searchTerm.trim().toLowerCase();
  const filteredLogs = logs.filter((log) => {
    const matchesRole = selectedRole === 'ALL' || log.agent_role === selectedRole;
    if (!matchesRole) return false;
    if (!term) return true;
    return (
      String(log.agent_id || '').toLowerCase().includes(term) ||
      String(log.reasoning_step || '').toLowerCase().includes(term) ||
      String(log.action || '').toLowerCase().includes(term)
    );
  });

  const roles = Array.from(new Set(logs.map((l) => l.agent_role).filter(Boolean)));

  return (
    <div className="page">

      <PageHeader
        eyebrow="Multi-Agent System"
        title="Agent Coordination & Activity Log"
        description="Real-time activity and message communication across vehicle agents, station agents, grid transformers, and fleet coordinators."
        actions={
          <button type="button" onClick={onRefresh} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {/* Live roster */}
      <Section
        title={`Agents in the running simulation (${agents.length})`}
        description="Roster published by the environment snapshot; goals are the agent's own declared objectives."
      >
        {agents.length === 0 ? (
          <StateBlock
            variant="empty"
            title="No active agent"
            detail="Start the simulation and step it once so the agents register themselves."
            action={
              onRefresh && (
                <button type="button" onClick={onRefresh} className="btn-secondary btn-sm">
                  Refresh
                </button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.identity} agent={agent} />
            ))}
          </div>
        )}
      </Section>

      {/* Log */}
      <Section
        title={`Decision and message log (${filteredLogs.length})`}
        description="One row per agent decision, newest first."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by agent, step or action…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input !pl-8"
                aria-label="Filter log entries"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap shrink-0">
                <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                Role
              </span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="form-input !w-auto shrink-0"
                aria-label="Filter by agent role"
              >
                <option value="ALL">All roles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        {logs.length === 0 ? (
          <StateBlock
            variant="empty"
            title="No agent decision has been logged yet"
            detail="Step the simulation from the dashboard, or run a request, and the agents will record their deliberations here."
          />
        ) : filteredLogs.length === 0 ? (
          <StateBlock
            variant="empty"
            title="No entry matches the filter"
            action={
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedRole('ALL');
                }}
                className="btn-secondary btn-sm"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="ai-table-container max-h-[520px] overflow-y-auto">
            <table className="ai-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Role</th>
                  <th>Reasoning step</th>
                  <th>Action</th>
                  <th className="num">Tick</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => (
                  <tr key={`${log.agent_id}-${i}`}>
                    <td className="col-code">{log.agent_id}</td>
                    <td>
                      <span className={ROLE_BADGE[log.agent_role] || 'badge-slate'}>
                        {(log.agent_role || 'agent').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="text-slate-700">{log.reasoning_step || '—'}</td>
                    <td className="font-medium text-blue-700">{log.action || '—'}</td>
                    <td className="num font-mono">
                      {log.tick ?? log.simulation_tick ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* PEAS specification, fetched from /api/peas by the shared component */}
      <PEASMatrixView />

    </div>
  );
}
