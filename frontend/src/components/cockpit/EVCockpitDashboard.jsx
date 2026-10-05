import React from 'react';
import { ArrowLeft } from 'lucide-react';
import cockpitImg from '../../assets/cockpit_exact.png';

export default function EVCockpitDashboard({ onSelectTab, onClose }) {
  
  const handleHotspotClick = (tabId) => {
    if (onSelectTab) onSelectTab(tabId);
    if (onClose) onClose();
  };

  return (
    <div className="w-screen h-screen bg-[#0B101B] text-white font-sans select-none flex flex-col items-center justify-between p-3 sm:p-6 overflow-hidden relative z-50">
      
      {/* SIMPLE & PROFESSIONAL TOP BAR */}
      <div className="w-full flex items-center justify-between z-30 px-3 sm:px-8 pt-1">
        
        {/* Simple & Clean Exit Button */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#2563EB] hover:to-[#3B82F6] text-white border border-[#3B82F6] text-xs font-bold transition-all cursor-pointer shadow-md uppercase tracking-wider active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-white" />
          <span>Exit Cockpit</span>
        </button>

        {/* Minimal Subdued Title */}
        <span className="text-xs text-zinc-400 font-mono tracking-widest uppercase">
          EV DIGITAL COCKPIT • HAVYON INTERFACE
        </span>

      </div>

      {/* CENTER INTERACTIVE COCKPIT DISPLAY IMAGE CONTAINER */}
      <div className="relative max-w-6xl w-full my-auto overflow-hidden border border-[#202F49] bg-[#0B101B] shadow-2xl">
        
        {/* Exact Uploaded Car Cockpit Image */}
        <img
          src={cockpitImg}
          alt="EV Car Cockpit Instrument Cluster"
          className="w-full h-auto object-contain block mx-auto"
        />

        {/* INVISIBLE HOTSPOT 1: LEFT SPEEDOMETER (Station & Route Search) */}
        <div
          onClick={() => handleHotspotClick('search')}
          className="absolute top-[10%] left-[2%] w-[33%] h-[78%] rounded-full cursor-pointer transition-all active:scale-95"
          title="Station & Route Search"
        />

        {/* INVISIBLE HOTSPOT 2: TOP WARNING LIGHTS (Smart Agents) */}
        <div
          onClick={() => handleHotspotClick('agents')}
          className="absolute top-[4%] left-[30%] w-[40%] h-[16%] rounded-xl cursor-pointer transition-all active:scale-95"
          title="Smart Agent Controllers"
        />

        {/* INVISIBLE HOTSPOT 3: CENTER 3D CAR & PLATFORM (Live Dashboard) */}
        <div
          onClick={() => handleHotspotClick('dashboard')}
          className="absolute top-[42%] left-[27%] w-[46%] h-[38%] rounded-2xl cursor-pointer transition-all active:scale-95"
          title="Live Dashboard & Bengaluru Map"
        />

        {/* INVISIBLE HOTSPOT 4: CENTER DRIVE MODE & GEAR D (Multi-Agent Negotiation) */}
        <div
          onClick={() => handleHotspotClick('negotiation')}
          className="absolute top-[22%] left-[35%] w-[30%] h-[18%] rounded-xl cursor-pointer transition-all active:scale-95"
          title="Multi-Agent Negotiation"
        />

        {/* INVISIBLE HOTSPOT 5: RIGHT POWER TACHOMETER / RPM (Smart Scheduler CSP) */}
        <div
          onClick={() => handleHotspotClick('csp')}
          className="absolute top-[10%] right-[2%] w-[33%] h-[78%] rounded-full cursor-pointer transition-all active:scale-95"
          title="Smart Scheduler (CSP)"
        />

        {/* INVISIBLE HOTSPOT 6: BOTTOM TELEMETRY FOOTER (System Evaluation) */}
        <div
          onClick={() => handleHotspotClick('evaluation')}
          className="absolute bottom-[2%] left-[20%] w-[60%] h-[12%] rounded-xl cursor-pointer transition-all active:scale-95"
          title="System Evaluation"
        />

      </div>

      {/* MINIMAL FOOTER */}
      <div className="w-full text-center text-[11px] text-zinc-500 font-mono py-0.5">
        Click any dial (Speedometer, 3D Car, Tachometer, Gear D) to navigate directly.
      </div>

    </div>
  );
}
