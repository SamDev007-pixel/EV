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
  SystemEvaluationView,
  SyllabusMappingView
} from './components';

import {
  fetchState,
  fetchAgentLogs,
  stepSimulation,
  resetSimulation
} from './services/api';

export default function App() {
  const [simState, setSimState] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync route hashes
  useEffect(() => {
    // Ensure light theme is active
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');

    const validTabs = [
      'dashboard',
      'ev_request',
      'station_search',
      'search_comparison',
      'scheduling',
      'knowledge_logic',
      'agents',
      'conflict_decision',
      'explanation',
      'evaluation',
      'syllabus'
    ];

    const checkRoute = () => {
      const h = window.location.hash.replace(/^#\/?/, '') || window.location.pathname.replace(/^\//, '');
      if (validTabs.includes(h)) {
        setActiveTab(h);
      } else if (h === 'search') {
        setActiveTab('search_comparison');
      } else if (h === 'csp') {
        setActiveTab('scheduling');
      } else if (h === 'logic') {
        setActiveTab('knowledge_logic');
      } else if (h === 'negotiation') {
        setActiveTab('conflict_decision');
      }
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
      setError('Backend API unreachable. Please confirm python run.py is running on port 8000.');
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
      const logs = await fetchAgentLogs();
      setAgentLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetSimulation = async () => {
    try {
      const reset = await resetSimulation();
      setSimState(reset);
      const logs = await fetchAgentLogs();
      setAgentLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !simState) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold text-slate-900">
          Intelligent EV Charging &amp; Resource Management System
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Loading Classical AI Reasoning Engines &amp; Knowledge Base...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* 1. Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* 2. Main Layout Container */}
      <div className={`flex-1 flex flex-col transition-all duration-200 ease-in-out ${
        isSidebarOpen ? 'lg:pl-64 xl:pl-72' : 'lg:pl-16'
      }`}>
        
        {/* Top Sticky Header */}
        <Header
          currentTick={simState?.current_tick_min || 0}
          activeTab={activeTab}
        />

        {/* Global Error Banner */}
        {error && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 text-xs text-rose-800 text-center font-medium">
            {error}
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <DashboardView
              simState={simState}
              onSelectTab={handleSelectTab}
              onStepSimulation={handleStepSimulation}
              onResetSimulation={handleResetSimulation}
            />
          )}

          {/* TAB 2: EV REQUEST */}
          {activeTab === 'ev_request' && (
            <EVRequestView
              onSelectTab={handleSelectTab}
              onWorkflowExecuted={() => loadData()}
            />
          )}

          {/* TAB 3: STATION SEARCH */}
          {activeTab === 'station_search' && (
            <StationSearchView
              stations={simState?.stations || []}
              evs={simState?.evs || []}
              onSelectTab={handleSelectTab}
            />
          )}

          {/* TAB 4: AI SEARCH COMPARISON */}
          {activeTab === 'search_comparison' && (
            <SearchComparisonView
              evs={simState?.evs || []}
            />
          )}

          {/* TAB 5: SMART SCHEDULING (CSP) */}
          {activeTab === 'scheduling' && (
            <CSPSchedulerView />
          )}

          {/* TAB 6: KNOWLEDGE & LOGIC */}
          {activeTab === 'knowledge_logic' && (
            <LogicReasoningView
              evs={simState?.evs || []}
              stations={simState?.stations || []}
            />
          )}

          {/* TAB 7: AGENT SYSTEM */}
          {activeTab === 'agents' && (
            <AgentActivityView
              agents={simState?.agents || []}
              logs={agentLogs}
              onRefresh={loadData}
            />
          )}

          {/* TAB 8: CONFLICT / GAME DECISION */}
          {activeTab === 'conflict_decision' && (
            <AgentNegotiationLogView />
          )}

          {/* TAB 9: DECISION EXPLANATION */}
          {activeTab === 'explanation' && (
            <DecisionExplanationView
              onSelectTab={handleSelectTab}
            />
          )}

          {/* TAB 10: EVALUATION */}
          {activeTab === 'evaluation' && (
            <SystemEvaluationView />
          )}

          {/* TAB 11: FOAI SYLLABUS MAPPING */}
          {activeTab === 'syllabus' && (
            <SyllabusMappingView
              onSelectTab={handleSelectTab}
            />
          )}

        </main>

        {/* Clean Professional Footer */}
        <footer className="border-t border-slate-200 py-4 px-6 bg-white text-center text-xs text-slate-500 font-sans mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Intelligent EV Charging &amp; Resource Management System &bull; Foundations of Artificial Intelligence (FOAI)
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              100% Classical AI &bull; No ML / No LLMs
            </span>
          </div>
        </footer>

      </div>

    </div>
  );
}
