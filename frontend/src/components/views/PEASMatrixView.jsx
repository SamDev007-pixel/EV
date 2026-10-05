import React from 'react';
import { X, Target, Layers, Sliders, Activity, Cpu } from 'lucide-react';

export default function PEASMatrixView({ isOpen, onClose, spec }) {
  if (!isOpen || !spec) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B101B]/80 backdrop-blur-md font-sans">
      <div className="glass-panel w-full max-w-3xl border border-[#202F49] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#131B2B] border-b border-[#202F49]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#162238] text-[#38BDF8] flex items-center justify-center border border-[#253755]">
              <Cpu className="w-4 h-4 text-[#38BDF8]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">PEAS Environment Formal Specification</h2>
              <p className="text-xs text-slate-400">Classical AI Intelligent Multi-Agent Architecture Matrix</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-[#1E2D4A] hover:bg-[#253755] text-slate-300 hover:text-white border border-[#202F49] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - 4 Quadrants Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto text-xs bg-[#0F1726]">
          
          {/* Performance Measure */}
          <div className="p-3.5 bg-[#131B2B] border border-[#202F49]">
            <div className="flex items-center gap-2 text-[#38BDF8] font-bold text-xs mb-2">
              <Target className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="uppercase tracking-wider">Performance Measure (P)</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-xs">
              {spec.performance_measure.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-[#38BDF8] font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Environment */}
          <div className="p-3.5 bg-[#131B2B] border border-[#202F49]">
            <div className="flex items-center gap-2 text-white font-bold text-xs mb-2">
              <Layers className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="uppercase tracking-wider">Environment (E)</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-xs">
              {spec.environment.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-slate-500 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actuators */}
          <div className="p-3.5 bg-[#131B2B] border border-[#202F49]">
            <div className="flex items-center gap-2 text-white font-bold text-xs mb-2">
              <Sliders className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="uppercase tracking-wider">Actuators (A)</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-xs">
              {spec.actuators.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-slate-500 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sensors */}
          <div className="p-3.5 bg-[#131B2B] border border-[#202F49]">
            <div className="flex items-center gap-2 text-[#38BDF8] font-bold text-xs mb-2">
              <Activity className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="uppercase tracking-wider">Sensors (S)</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-xs">
              {spec.sensors.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-[#38BDF8] font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#131B2B] border-t border-[#202F49] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#2563EB] hover:to-[#3B82F6] border border-[#3B82F6] shadow-sm transition-all cursor-pointer uppercase tracking-wider"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
