import React from 'react';
import { Cpu, Activity, Clock } from 'lucide-react';

export default function Header({ currentTick = 0, activeTab = 'dashboard' }) {
  return (
    <header className="border-b border-slate-200 sticky top-0 z-30 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Brand & Project Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Intelligent EV Charging & Resource Management System
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                FOAI Classical AI
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Foundations of Artificial Intelligence • Symbol-Driven Decision Support
            </p>
          </div>
        </div>

        {/* AI Decision Pipeline Flow Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
          <span className="font-semibold text-slate-700">Pipeline:</span>
          <span className="px-1.5 py-0.5 rounded bg-white text-blue-700 border border-slate-200">Input</span>
          <span className="text-slate-400">→</span>
          <span className="px-1.5 py-0.5 rounded bg-white text-emerald-700 border border-slate-200">Reasoning</span>
          <span className="text-slate-400">→</span>
          <span className="px-1.5 py-0.5 rounded bg-white text-sky-700 border border-slate-200">Algorithm</span>
          <span className="text-slate-400">→</span>
          <span className="px-1.5 py-0.5 rounded bg-white text-indigo-700 border border-slate-200">Decision</span>
          <span className="text-slate-400">→</span>
          <span className="px-1.5 py-0.5 rounded bg-white text-teal-700 border border-slate-200">Explanation</span>
        </div>

        {/* Status Telemetry (Academic Clock & State) */}
        <div className="flex items-center gap-3 text-xs self-start md:self-center">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-medium text-slate-500 font-sans">Sim Time:</span>
            <span className="font-semibold text-slate-900">{currentTick ?? 0}m</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Deterministic AI</span>
          </div>
        </div>

      </div>
    </header>
  );
}
