// Temporary harness: mounts every screen (`?screen=<name>`) for smoke testing.
import React from 'react';
import { createRoot } from 'react-dom/client';
import './src/index.css';
import {
  DashboardView, EVRequestView, StationSearchView, SearchComparisonView,
  CSPSchedulerView, LogicReasoningView, AgentActivityView, AgentNegotiationLogView,
  DecisionExplanationView, SystemEvaluationView
} from './src/components/index.js';

const VIEWS = {
  dashboard: DashboardView,
  ev_request: EVRequestView,
  station_search: StationSearchView,
  search_comparison: SearchComparisonView,
  scheduling: CSPSchedulerView,
  knowledge_logic: LogicReasoningView,
  agents: AgentActivityView,
  conflict_decision: AgentNegotiationLogView,
  explanation: DecisionExplanationView,
  evaluation: SystemEvaluationView,
};

const noop = () => {};
const params = new URLSearchParams(window.location.search);
const screen = params.get('screen') || 'dashboard';
const View = VIEWS[screen];

window.__SMOKE_READY = false;
const root = createRoot(document.getElementById('root'));
root.render(<View simState={window.__SMOKE_STATE} evs={window.__SMOKE_STATE?.evs || []}
  stations={window.__SMOKE_STATE?.stations || []} agents={window.__SMOKE_STATE?.agents || []}
  logs={window.__SMOKE_LOGS || []} onSelectTab={noop} onStepSimulation={noop}
  onResetSimulation={noop} onRefresh={noop} onWorkflowExecuted={noop} />);
setTimeout(() => { window.__SMOKE_READY = true; }, 1);
