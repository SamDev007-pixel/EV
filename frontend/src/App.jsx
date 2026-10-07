import React, { useState, useEffect } from 'react';
import {
  Header,
  Sidebar,
  DashboardView,
  EVRequestView,
  StationSearchView,
  SearchComparisonView,
  CSPSchedulerView,
  LogicReasoningView,
  AgentActivityView,
  AgentNegotiationLogView,
  DecisionExplanationView,
  SystemEvaluationView
} from './components';

import {
  fetchState,
  fetchAgentLogs,
  stepSimulation,
  resetSimulation
} from './services/api';

const VALID_TABS = [
  'dashboard',
  'ev_request',
  'station_search',
  'search_comparison',
  'scheduling',
  'knowledge_logic',
  'agents',
  'conflict_decision',
  'explanation',
  'evaluation'
];

const HASH_ALIASES = {
  search: 'search_comparison',
  csp: 'scheduling',
  logic: 'knowledge_logic',
  negotiation: 'conflict_decision'
};

export default function App() {
  const [simState, setSimState] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolve the active page from the URL hash / path.
  useEffect(() => {
    const checkRoute = () => {
      const h =
        window.location.hash.replace(/^#\/?/, '') ||
        window.location.pathname.replace(/^\//, '');
      if (VALID_TABS.includes(h)) setActiveTab(h);
      else if (HASH_ALIASES[h]) setActiveTab(HASH_ALIASES[h]);
    };

    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, []);

  const loadData = async () => {
    try {
      const [stateData, logsData] = await Promise.all([
        fetchState(),
        fetchAgentLogs().catch(() => [])
      ]);
      setSimState(stateData);
      setAgentLogs(logsData);
      setError(null);
    } catch (err) {
      console.error('Failed to load simulation state', err);
      setError(
        'The backend API is unreachable. Start it with "python run.py" inside the backend folder (default port 8000), then reload this page.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    window.location.hash = tabId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStepSimulation = async () => {
    try {
      const updated = await stepSimulation();
      setSimState(updated);
      setAgentLogs(await fetchAgentLogs());
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetSimulation = async () => {
    try {
      const reset = await resetSimulation();
      setSimState(reset);
      setAgentLogs(await fetchAgentLogs());
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !simState) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center p-6 text-center font-sans">
        <div
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.93), rgba(255, 255, 255, 0.93)), url('/ev-bg.png')" }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col items-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
          <h2 className="mt-4 text-base font-bold text-slate-900">
            Intelligent EV Charging &amp; Resource Management System
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Loading charging network and simulation state&hellip;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col font-sans text-slate-900">
      {/* Background Image with White Screen Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.93), rgba(255, 255, 255, 0.93)), url('/ev-bg.png')" }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Content column, offset by the sidebar width */}
        <div
          className={`flex flex-1 flex-col transition-[padding] duration-200 ease-in-out ${
            isSidebarOpen ? 'lg:pl-60' : 'lg:pl-14'
          }`}
        >

          <Header
            currentTick={simState?.current_tick_min ?? 0}
            strategyName={simState?.strategy_name}
            onToggleSidebar={() => setIsSidebarOpen(true)}
          />

          {error && (
            <div className="border-b border-rose-200 bg-rose-50/95">
            <div className="mx-auto max-w-content px-4 py-2.5 text-xs font-medium text-rose-800 sm:px-6 lg:px-8">
              {error}
            </div>
          </div>
        )}

        {/* Single page container shared by every screen */}
        <main className="mx-auto w-full max-w-content flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              simState={simState}
              onSelectTab={handleSelectTab}
              onStepSimulation={handleStepSimulation}
              onResetSimulation={handleResetSimulation}
            />
          )}

          {activeTab === 'ev_request' && (
            <EVRequestView
              onSelectTab={handleSelectTab}
              onWorkflowExecuted={() => loadData()}
            />
          )}

          {activeTab === 'station_search' && (
            <StationSearchView
              stations={simState?.stations || []}
              evs={simState?.evs || []}
              onSelectTab={handleSelectTab}
            />
          )}

          {activeTab === 'search_comparison' && (
            <SearchComparisonView evs={simState?.evs || []} />
          )}

          {activeTab === 'scheduling' && <CSPSchedulerView />}

          {activeTab === 'knowledge_logic' && (
            <LogicReasoningView
              evs={simState?.evs || []}
              stations={simState?.stations || []}
            />
          )}

          {activeTab === 'agents' && (
            <AgentActivityView
              agents={simState?.agents || []}
              logs={agentLogs}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'conflict_decision' && <AgentNegotiationLogView />}

          {activeTab === 'explanation' && (
            <DecisionExplanationView onSelectTab={handleSelectTab} />
          )}

          {activeTab === 'evaluation' && <SystemEvaluationView />}
        </main>

        <footer className="mt-auto border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-content flex-col items-center justify-between gap-2 px-4 py-4 text-2xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
            <span>
              Intelligent EV Charging &amp; Resource Management System
            </span>
            <span className="text-slate-400">
              v1.0.0 &bull; Intelligent EV Resource Management
            </span>
          </div>
        </footer>

      </div>
    </div>
  </div>
  );
}
