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
  Menu
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ev_request', label: 'EV Request', icon: FileEdit },
  { id: 'station_search', label: 'Station Search', icon: Compass },
  { id: 'search_comparison', label: 'Search Comparison', icon: GitCompare },
  { id: 'scheduling', label: 'CSP Scheduling', icon: Calendar },
  { id: 'knowledge_logic', label: 'Knowledge & Logic', icon: Brain },
  { id: 'agents', label: 'Agent System', icon: Users },
  { id: 'conflict_decision', label: 'Conflict Decision', icon: Scale },
  { id: 'explanation', label: 'Decision Explanation', icon: HelpCircle },
  { id: 'evaluation', label: 'Evaluation', icon: BarChart2 }
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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#EAEDED] bg-white transition-[width,transform] duration-200 ease-in-out ${
          isOpen ? 'w-60 translate-x-0' : '-translate-x-full lg:w-14 lg:translate-x-0'
        }`}
      >
        {/* Sidebar header - same h-16 as the application header */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-[#EAEDED] ${
            isOpen ? 'justify-between px-3.5' : 'justify-center px-0'
          }`}
        >
          {isOpen && (
            <span className="text-xs font-bold uppercase tracking-wider text-[#545B64] select-none">
              Navigation
            </span>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? 'Collapse navigation' : 'Expand navigation'}
            title={isOpen ? 'Collapse navigation' : 'Expand navigation'}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#545B64] hover:bg-[#F2F3F3] hover:text-[#16191F] transition-colors"
          >
            <Menu className="h-5 w-5 shrink-0" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
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
                className={`flex w-full items-center ${
                  isOpen ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'
                } rounded-r-md rounded-l-none border-y-0 border-r-0 border-l-[3px] text-left transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'border-l-[#0972D3] bg-[#F2F8FD] font-semibold text-[#0972D3] shadow-xs'
                    : 'border-l-transparent text-[#545B64] hover:bg-[#F2F3F3] hover:text-[#16191F]'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-colors ${
                    isActive ? 'text-[#0972D3]' : 'text-[#687078]'
                  }`}
                />
                {isOpen && (
                  <span className="flex-1 truncate text-sm leading-5">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
