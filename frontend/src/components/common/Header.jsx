import React from 'react';
import { Clock, Zap, Menu } from 'lucide-react';

/**
 * Application header. Fixed height, one alignment grid: brand on the left,
 * pipeline indicator in the middle (wide screens only), run state on the right.
 */
export default function Header({ currentTick = 0, strategyName, onToggleSidebar }) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#EAEDED] shadow-header">
      <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-4 sm:px-6 lg:px-8">

        {/* Navigation toggle: the sidebar is off-canvas below the lg breakpoint, so the
            button that opens it has to live in the header. */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            title="Toggle navigation"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#545B64] hover:bg-[#F2F3F3] hover:text-[#16191F] transition-colors lg:hidden mr-1"
          >
            <Menu className="h-5 w-5 shrink-0" />
          </button>
        )}

        {/* Brand */}
        <div className="flex min-w-0 items-center">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-[#16191F] sm:text-base">
              Intelligent EV Charging &amp; Resource Management System
            </h1>
            <p className="truncate text-xs text-[#545B64]">
              Fleet Operations &amp; Intelligent Charging Management
            </p>
          </div>
        </div>

        {/* Run state */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {strategyName && (
            <span className="hidden items-center gap-1.5 rounded-md border border-[#EAEDED] bg-[#F8F9FA] px-2.5 py-1.5 text-2xs font-medium text-[#545B64] lg:flex">
              <Zap className="h-3.5 w-3.5 text-[#879596]" />
              <span className="font-mono text-2xs">{strategyName}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-md border border-[#EAEDED] bg-[#F8F9FA] px-2.5 py-1.5 text-xs text-[#16191F]">
            <Clock className="h-3.5 w-3.5 text-[#879596]" />
            <span className="text-2xs text-[#545B64]">Sim time</span>
            <span className="font-mono font-semibold text-[#16191F]">{currentTick ?? 0}m</span>
          </span>
        </div>

      </div>
    </header>
  );
}
