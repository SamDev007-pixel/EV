import React, { useState } from 'react';
import {
  Users,
  Cpu,
  Terminal,
  Filter,
  RefreshCw,
  CheckCircle2,
  Shield,
  MessageSquare,
  Search,
  ArrowRight
} from 'lucide-react';

export default function AgentActivityView({ agents = [], logs = [], onRefresh }) {
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter((log) => {
    const matchesRole = selectedRole === 'ALL' || log.agent_role === selectedRole;
    const matchesSearch =
      (log.agent_id && log.agent_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.reasoning_step && log.reasoning_step.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  const agentArchetypes = [
    {
      role: 'EV_AGENT',
      name: 'EV Agent',
      type: 'Utility-Based Agent',
      objective: 'Minimize travel cost and arrival delay while guaranteeing SOC ≥ 80%.',
      sensors: ['Battery SOC %', 'GPS Coordinates', 'Clock Deadline'],
      actuators: ['Submit RFP', 'Accept Allocation', 'Reroute to Hub']
    },
    {
      role: 'STATION_AGENT',
      name: 'Station Agent',
      type: 'Model-Based Reflex Agent',
      objective: 'Maximize bay utilization and maintain hardware health & connector safety.',
      sensors: ['Bay Sensor', 'Connector Lock Flag', 'Temperature Telemetry'],
      actuators: ['Reserve Bay', 'Start Charge Cycle', 'Assert Fault State']
    },
    {
      role: 'COORDINATOR_AGENT',
      name: 'Coordinator Agent',
      type: 'Arbitration Agent',
      objective: 'Solve CSP schedule and arbitrate multi-vehicle bay contention via Nash Bargaining.',
      sensors: ['Incoming Fleet RFPs', 'Bay Capacity Matrix'],
      actuators: ['Run Backtracking CSP', 'Issue Schedule Grants', 'Enforce Preemption']
    },
    {
      role: 'GRID_AGENT',
      name: 'Resource / Grid Agent',
      type: 'Constraint Monitor Agent',
      objective: 'Prevent transformer overload and balance municipal substation feeder draw.',
      sensors: ['Feeder Load (kW)', 'Peak Tariff Signal'],
      actuators: ['Throttle Charging kW', 'Issue Overload Warning', 'Prioritize Green Energy']
    }
  ];

  const getRoleBadge = (role) => {
    switch (role) {
      case 'EV_AGENT':
        return <span className="badge-blue text-[10px]">EV AGENT</span>;
      case 'STATION_AGENT':
        return <span className="badge-teal text-[10px]">STATION AGENT</span>;
      case 'COORDINATOR_AGENT':
        return <span className="badge-emerald text-[10px]">COORDINATOR</span>;
      case 'GRID_AGENT':
      case 'ENERGY_AGENT':
        return <span className="badge-amber text-[10px]">RESOURCE / GRID</span>;
      default:
        return <span className="badge-slate text-[10px]">{role}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Academic Context */}
      <div className="ai-card p-5 bg-gradient-to-r from-blue-50/40 via-white to-slate-50 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-blue">UNIT I: INTELLIGENT AGENTS</span>
              <span className="text-xs text-slate-500 font-mono">PEAS FRAMEWORK • FIPA-ACL MESSAGING</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Multi-Agent Architecture &amp; Decision Logs
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Decentralized autonomous agents executing rational percept-reasoning-actuator cycles. 
              Displays genuine FIPA-ACL communication messages, state transitions, and coordination actions.
            </p>
          </div>

          <button
            onClick={onRefresh}
            className="btn-secondary text-xs flex items-center gap-1.5 self-start md:self-center"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Agent Percepts</span>
          </button>
        </div>
      </div>

      {/* Agent Archetypes Grid (The 4 Core Agents) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {agentArchetypes.map((arch) => (
          <div key={arch.role} className="ai-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">{arch.name}</h3>
              {getRoleBadge(arch.role)}
            </div>
            <span className="text-[11px] font-mono text-blue-600 block">{arch.type}</span>
            <p className="text-xs text-slate-600 leading-relaxed">{arch.objective}</p>

            <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1">
              <div>
                <strong className="text-slate-700">Sensors:</strong>{' '}
                <span className="text-slate-500">{arch.sensors.join(', ')}</span>
              </div>
              <div>
                <strong className="text-slate-700">Actuators:</strong>{' '}
                <span className="text-slate-500">{arch.actuators.join(', ')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Agent Communication & Action Log */}
      <div className="ai-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-600" />
              <span>Real Percept-Action &amp; FIPA-ACL Message Stream</span>
            </h3>
            <p className="text-xs text-slate-500">
              Live chronological record of agent rational deliberations and inter-agent coordination
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input text-xs pl-8 py-1"
              />
            </div>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="form-input text-xs py-1"
            >
              <option value="ALL">All Roles</option>
              <option value="EV_AGENT">EV Agents</option>
              <option value="STATION_AGENT">Station Agents</option>
              <option value="COORDINATOR_AGENT">Coordinator</option>
              <option value="GRID_AGENT">Resource / Grid</option>
            </select>
          </div>
        </div>

        {/* Message Log Table */}
        <div className="ai-table-container max-h-[460px] overflow-y-auto">
          <table className="ai-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Agent ID</th>
                <th>Role</th>
                <th>Reasoning Step</th>
                <th>Action Taken</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs text-slate-500 whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : `${i * 2 + 1}m`}
                    </td>
                    <td className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                      {log.agent_id}
                    </td>
                    <td>{getRoleBadge(log.agent_role)}</td>
                    <td className="text-xs text-slate-700 max-w-md">
                      {log.reasoning_step}
                    </td>
                    <td className="font-mono text-xs text-blue-700 font-semibold whitespace-nowrap">
                      {log.action}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-400">
                    No matching agent messages found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
