import React, { useState } from 'react';
import { Play, Pause, FastForward, RotateCcw, AlertCircle, PlusCircle, Sliders, X, Clock, Zap, CheckCircle2 } from 'lucide-react';

export default function ControlPanel({
  onStep,
  onReset,
  onInjectEmergency,
  onAddCustomEV,
  onStrategyChange,
  currentStrategy = 'FCFS_BASELINE',
  isPlaying = false,
  onTogglePlay,
  currentTick = 0,
  activeEVCount = 0,
  gridLoad = 0
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [customEvName, setCustomEvName] = useState('');
  const [customEvBattery, setCustomEvBattery] = useState(60);
  const [customEvSoc, setCustomEvSoc] = useState(25);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const showNotice = (msg) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 3000);
  };

  const handleStepClick = (ticks) => {
    onStep(ticks);
    showNotice(`Advanced simulation time by +${ticks}m`);
  };

  const handleResetClick = () => {
    onReset();
    showNotice('Simulation reset to initial state (Tick: 0m)');
  };

  const handleEmergencyClick = () => {
    onInjectEmergency();
    showNotice('Priority Emergency EV (108 Ambulance) dispatched & added to queue!');
  };

  const handleStrategySelect = (val) => {
    onStrategyChange(val);
    const names = {
      SMART_AGENT: 'Smart Agent (Multi-Agent Coordination)',
      PEAK_SHAVING: 'Peak Shaving (Grid Capped at 300 kW)',
      PRIORITY_DRIVEN: 'Priority Driven (Emergency Preemption)',
      FCFS_BASELINE: 'First-Come First-Served Baseline'
    };
    showNotice(`Strategy switched to ${names[val] || val}`);
  };

  const handleCreateCustom = (e) => {
    e.preventDefault();
    const evId = customEvName.trim() || `EV-${Math.floor(100 + Math.random() * 900)}`;
    onAddCustomEV({
      id: evId,
      batteryCapacity: Number(customEvBattery),
      currentBatteryLevel: (Number(customEvSoc) / 100.0) * Number(customEvBattery),
      requiredBatteryLevel: 0.8 * Number(customEvBattery),
      chargingRate: 100.0,
      arrivalTime: currentTick,
      departureDeadline: currentTick + 120,
      priority: 'STANDARD',
      currentLocation: { x: 4.0, y: 4.0 },
      destination: { x: 7.0, y: 7.0 },
      status: 'QUEUED'
    });
    setShowAddModal(false);
    setCustomEvName('');
    showNotice(`Vehicle ${evId} added to active fleet queue!`);
  };

  const hours = Math.floor(currentTick / 60).toString().padStart(2, '0');
  const minutes = (currentTick % 60).toString().padStart(2, '0');

  return (
    <div className="relative font-sans space-y-2">
      
      {/* Toast Feedback Notification Banner */}
      {feedbackMsg && (
        <div className="px-4 py-2 bg-[#13233C] border border-[#2563EB] text-[#38BDF8] text-xs font-semibold flex items-center gap-2 shadow-lg transition-all animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Main Glass Control Panel */}
      <div className="glass-panel p-3.5 sm:p-4 border border-[#202F49] shadow-xl flex flex-col lg:flex-row items-center justify-between gap-3">
        
        {/* LEFT: Simulation Clock & Engine Stepping Controls */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto text-xs">
          
          {/* Live Simulation Clock HUD */}
          <div className="flex items-center gap-2 bg-[#0E1624] px-3 py-1.5 border border-[#202F49] shrink-0">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-300">
                {isPlaying ? 'RUNNING' : 'PAUSED'}
              </span>
            </div>
            <div className="h-3 w-[1px] bg-[#202F49]" />
            <div className="flex items-center gap-1 font-mono text-xs">
              <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="text-white font-bold">{hours}:{minutes}</span>
              <span className="text-[10px] text-slate-400">({currentTick}m)</span>
            </div>
          </div>

          {/* Crisp Play / Pause Toggle */}
          <button
            onClick={() => {
              onTogglePlay();
              showNotice(isPlaying ? 'Simulation paused' : 'Simulation running in real-time');
            }}
            title={isPlaying ? 'Pause Simulation Clock' : 'Start Simulation Clock (1s = 1m)'}
            className={`px-4 py-2 font-bold flex items-center gap-2 border transition-all cursor-pointer shadow-md active:scale-95 ${
              isPlaying
                ? 'bg-[#1E293B] hover:bg-[#283548] text-white border-[#334155]'
                : 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#2563EB] hover:to-[#3B82F6] text-white border border-[#3B82F6]'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 fill-white text-white" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Time Advance Step Buttons */}
          <div className="flex items-center bg-[#131B2B] border border-[#223350] p-0.5">
            <button
              onClick={() => handleStepClick(1)}
              title="Advance simulation by 1 minute"
              className="px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-[#1E2D4A] text-xs font-mono font-medium transition-all cursor-pointer"
            >
              +1m
            </button>
            <button
              onClick={() => handleStepClick(5)}
              title="Advance simulation by 5 minutes"
              className="px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-[#1E2D4A] text-xs font-mono font-medium transition-all cursor-pointer"
            >
              +5m
            </button>
            <button
              onClick={() => handleStepClick(15)}
              title="Advance simulation by 15 minutes"
              className="px-2.5 py-1.5 text-zinc-200 hover:text-[#38BDF8] hover:bg-[#1E2D4A] text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1"
            >
              <FastForward className="w-3 h-3 text-zinc-400" />
              +15m
            </button>
          </div>

          {/* Reset Environment Button */}
          <button
            onClick={handleResetClick}
            title="Reset simulation to initial seed & 0 elapsed time"
            className="p-2 bg-[#131B2B] hover:bg-[#1E2D4A] text-zinc-300 hover:text-white border border-[#223350] hover:border-[#3B82F6] transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* CENTER: Scheduling Strategy Selector */}
        <div className="flex items-center gap-2 w-full lg:w-auto text-xs">
          <div className="flex items-center gap-1.5 text-zinc-400 font-medium shrink-0">
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Strategy:</span>
          </div>
          <select
            value={currentStrategy}
            onChange={(e) => handleStrategySelect(e.target.value)}
            className="w-full lg:w-auto bg-[#131B2B] border border-[#223350] hover:border-[#3B82F6] text-white text-xs px-3 py-2 font-medium focus:outline-none focus:border-[#3B82F6] cursor-pointer transition-all"
          >
            <option value="FCFS_BASELINE">First-Come First-Served</option>
            <option value="PRIORITY_DRIVEN">Priority Driven (Preemptive)</option>
            <option value="PEAK_SHAVING">Peak Shaving (Grid Capped)</option>
            <option value="SMART_AGENT">Smart Multi-Agent Coordinator</option>
          </select>
        </div>

        {/* RIGHT: Quick Action Triggers */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end text-xs">
          
          {/* Inject Emergency 108 Vehicle */}
          <button
            onClick={handleEmergencyClick}
            title="Spawn Priority Emergency EV (Ambulance 108) with charging preemption"
            className="px-3 py-2 bg-[#2B1115] hover:bg-[#3D181E] text-[#F87171] hover:text-white border border-[#6B1D26] hover:border-[#EF4444] font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]" />
            <span>Priority EV</span>
          </button>

          {/* Add Custom EV */}
          <button
            onClick={() => setShowAddModal(true)}
            title="Register a custom EV into fleet queue"
            className="px-3 py-2 bg-[#131B2B] hover:bg-[#1E2D4A] text-zinc-200 hover:text-white border border-[#223350] hover:border-[#3B82F6] font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5 text-zinc-400" />
            <span>Add EV</span>
          </button>

        </div>

      </div>

      {/* Add Custom EV Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B101B]/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-sm p-5 border border-[#202F49] space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#202F49] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[#38BDF8]" />
                <span>Register Vehicle into Fleet</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-[#1E2D4A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustom} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Vehicle Identifier / Model</label>
                <input
                  type="text"
                  placeholder="e.g. Tata Nexon EV (EV-901)"
                  value={customEvName}
                  onChange={(e) => setCustomEvName(e.target.value)}
                  className="w-full bg-[#131B2B] border border-[#202F49] px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6] font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Battery (kWh)</label>
                  <input
                    type="number"
                    value={customEvBattery}
                    onChange={(e) => setCustomEvBattery(e.target.value)}
                    className="w-full bg-[#131B2B] border border-[#202F49] px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6] font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Current SoC (%)</label>
                  <input
                    type="number"
                    min="5"
                    max="95"
                    value={customEvSoc}
                    onChange={(e) => setCustomEvSoc(e.target.value)}
                    className="w-full bg-[#131B2B] border border-[#202F49] px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6] font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#202F49]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-zinc-400 hover:text-white hover:bg-[#1E2D4A] font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#2563EB] hover:to-[#3B82F6] text-white font-bold cursor-pointer transition-all border border-[#3B82F6] shadow-md"
                >
                  Spawn EV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
