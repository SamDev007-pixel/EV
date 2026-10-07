import React from 'react';
import {
  LayoutDashboard,
  FileEdit,
  Compass,
  GitCompare,
  Calendar,
  Brain,
  Users,
  Scale,
  HelpCircle,
  BarChart2,
  Menu,
  ShieldCheck
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, step: '01' },
  { id: 'ev_request', label: 'EV Request', icon: FileEdit, step: '02' },
  { id: 'station_search', label: 'Station Search', icon: Compass, step: '03' },
  { id: 'search_comparison', label: 'Search Comparison', icon: GitCompare, step: '04' },
  { id: 'scheduling', label: 'CSP Scheduling', icon: Calendar, step: '05' },
  { id: 'knowledge_logic', label: 'Knowledge & Logic', icon: Brain, step: '06' },
  { id: 'agents', label: 'Agent System', icon: Users, step: '07' },
  { id: 'conflict_decision', label: 'Conflict Decision', icon: Scale, step: '08' },
  { id: 'explanation', label: 'Decision Explanation', icon: HelpCircle, step: '09' },
  { id: 'evaluation', label: 'Evaluation', icon: BarChart2, step: '10' }
];

/**
 * Workflow navigation. The sidebar header is exactly the same height as the
 * application header so the two chrome bars align on wide screens, and the nav
 * items use one consistent row height and padding throughout.
 */
export default function Sidebar({ activeTab, onSelectTab, isOpen = true, onToggle, onClose }) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose || onToggle}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-200 ease-in-out ${
          isOpen ? 'w-64 translate-x-0 xl:w-72' : '-translate-x-full lg:w-16 lg:translate-x-0'
        }`}
      >
        {/* Sidebar header - same h-16 as the application header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          {isOpen ? (
            <span className="field-label !mb-0 text-slate-500">
              Workflow
            </span>
          ) : (
            <span className="mx-auto h-2 w-2 rounded-full bg-blue-600" />
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? 'Collapse navigation' : 'Expand navigation'}
            title={isOpen ? 'Collapse navigation' : 'Expand navigation'}
            className="btn-ghost btn-sm -mr-2 px-1.5"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  if (window.innerWidth < 1024 && onClose) onClose();
                }}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-xs transition-colors ${
                  isActive
                    ? 'border-blue-200 bg-blue-50 font-semibold text-blue-700'
                    : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {isOpen && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    <span
                      className={`shrink-0 font-mono text-2xs ${
                        isActive ? 'text-blue-500' : 'text-slate-300'
                      }`}
                    >
                      {item.step}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer note */}
        {isOpen ? (
          <div className="m-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-2xs font-bold text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              <span>Decision Engine v1.0</span>
            </div>
            <p className="mt-1 text-2xs leading-relaxed text-slate-500">
              Deterministic classical AI: search, constraint satisfaction, logical inference and
              game theory. No machine learning.
            </p>
          </div>
        ) : (
          <div className="flex justify-center border-t border-slate-200 p-3">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
          </div>
        )}
      </aside>
    </>
  );
}
