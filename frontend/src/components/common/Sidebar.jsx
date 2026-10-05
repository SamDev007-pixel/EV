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
  GraduationCap,
  Menu,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  onSelectTab,
  isOpen = true,
  onToggle,
  onClose
}) {
  const navItems = [
    { id: 'dashboard', label: '1. Dashboard', icon: LayoutDashboard, category: 'Overview' },
    { id: 'ev_request', label: '2. EV Request', icon: FileEdit, category: 'Input & Formulation' },
    { id: 'station_search', label: '3. Station Search', icon: Compass, category: 'Spatial & Reachability' },
    { id: 'search_comparison', label: '4. AI Search Comparison', icon: GitCompare, category: 'Search Algorithms' },
    { id: 'scheduling', label: '5. Smart Scheduling (CSP)', icon: Calendar, category: 'Constraint Satisfaction' },
    { id: 'knowledge_logic', label: '6. Knowledge & Logic', icon: Brain, category: 'Knowledge Reasoning' },
    { id: 'agents', label: '7. Agent System', icon: Users, category: 'Multi-Agent PEAS' },
    { id: 'conflict_decision', label: '8. Conflict / Game Decision', icon: Scale, category: 'Game Theory' },
    { id: 'explanation', label: '9. Decision Explanation', icon: HelpCircle, category: 'Explainable AI', badge: 'Core' },
    { id: 'evaluation', label: '10. Evaluation', icon: BarChart2, category: 'Benchmarking' },
    { id: 'syllabus', label: '11. FOAI Syllabus Mapping', icon: GraduationCap, category: 'Academic Reference', badge: 'Syllabus' }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose || onToggle}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between bg-white border-r border-slate-200 transition-all duration-200 ease-in-out ${
          isOpen ? 'w-64 xl:w-72 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16'
        }`}
      >
        {/* Top: Header */}
        <div>
          <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
            {isOpen ? (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  AI Navigation
                </span>
              </div>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mx-auto"></span>
            )}

            <button
              onClick={onToggle}
              title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Items List */}
          <nav className="p-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-10rem)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (window.innerWidth < 1024 && onClose) onClose();
                  }}
                  title={item.label}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md transition-all cursor-pointer text-left ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    {isOpen && <span className="truncate">{item.label}</span>}
                  </div>

                  {isOpen && item.badge && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded font-semibold shrink-0 ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Academic Disclaimer & Methodology Card */}
        {isOpen ? (
          <div className="p-3 m-2 border border-slate-200 rounded-lg bg-slate-50">
            <div className="flex items-center gap-2 text-slate-800 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>FOAI Academic Project</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Classical Artificial Intelligence. Deterministic algorithms, formal logic & constraint satisfaction. Zero ML / Neural Networks.
            </p>
          </div>
        ) : (
          <div className="p-2 border-t border-slate-200 flex justify-center">
            <ShieldCheck className="w-4 h-4 text-blue-600" title="Classical AI - FOAI" />
          </div>
        )}
      </aside>
    </>
  );
}
