import React from 'react';
import { Cpu, Clock, Zap, Menu } from 'lucide-react';

/**
 * Application header. Fixed height, one alignment grid: brand on the left,
 * pipeline indicator in the middle (wide screens only), run state on the right.
 */
export default function Header({ currentTick = 0, strategyName, onToggleSidebar }) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-header">
      <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-4 sm:px-6 lg:px-8">

        {/* Navigation toggle: the sidebar is off-canvas below the lg breakpoint, so the
            button that opens it has to live in the header. */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            title="Toggle navigation"
            className="btn-ghost -ml-2 px-1.5 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Brand */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Cpu className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">
              Intelligent EV Charging &amp; Resource Management System
            </h1>
            <p className="truncate text-xs text-slate-500">
              Classical decision support &middot; search, constraint satisfaction, logic and game theory
            </p>
          </div>
        </div>

        {/* Pipeline indicator */}
        <div className="ml-auto hidden items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-2xs font-medium text-slate-600 xl:flex">
          <span className="font-semibold text-slate-700">Pipeline</span>
          <span className="text-slate-300">|</span>
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-blue-700">Input</span>
          <span className="text-slate-400">&rarr;</span>
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-indigo-700">Reasoning</span>
          <span className="text-slate-400">&rarr;</span>
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-sky-700">Algorithm</span>
          <span className="text-slate-400">&rarr;</span>
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-emerald-700">Decision</span>
          <span className="text-slate-400">&rarr;</span>
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-teal-700">Explanation</span>
        </div>

        {/* Run state */}
        <div className="ml-auto flex shrink-0 items-center gap-2 xl:ml-0">
          {strategyName && (
            <span className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-2xs font-medium text-slate-600 lg:flex">
              <Zap className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-mono text-2xs">{strategyName}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-2xs text-slate-500">Sim time</span>
            <span className="font-mono font-semibold text-slate-900">{currentTick ?? 0}m</span>
          </span>
          <span className="hidden items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-2xs font-medium text-emerald-800 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Deterministic
          </span>
        </div>

      </div>
    </header>
  );
}
