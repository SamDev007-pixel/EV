import React from 'react';
import { Zap, Sun, AlertTriangle, ShieldAlert, CheckCircle2, Gauge, Clock, DollarSign } from 'lucide-react';

export default function GridStatusGauge({ grid, metrics }) {
  if (!grid) return null;

  const currentLoad = grid.currentLoad ?? grid.net_grid_demand_kw ?? 0.0;
  const maxCapacity = grid.maximumCapacity ?? grid.transformer_max_capacity_kw ?? 450.0;
  const loadPct = grid.load_percentage ?? Math.round((currentLoad / maxCapacity) * 100);
  const headroom = grid.capacity_headroom_kw ?? Math.max(0, maxCapacity - currentLoad);

  const status = grid.status || 'STABLE';

  let statusColor = "text-[#38BDF8] bg-[#162947] border-[#2563EB]/60";
  let barColor = "bg-gradient-to-r from-[#1D4ED8] to-[#38BDF8]";
  let statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-[#38BDF8]" />;
  
  if (status === 'WARNING') {
    statusColor = "text-[#F59E0B] bg-[#2E1E0F] border-[#D97706]/60";
    barColor = "bg-gradient-to-r from-[#1D4ED8] via-[#D97706] to-[#DC2626]";
    statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />;
  } else if (status === 'CRITICAL_OVERLOAD' || status === 'CRITICAL') {
    statusColor = "text-[#EF4444] bg-[#3B1518] border-[#DC2626]/70 animate-pulse";
    barColor = "bg-[#DC2626]";
    statusIcon = <ShieldAlert className="w-3.5 h-3.5 text-[#EF4444]" />;
  }

  const avgWait = metrics?.average_wait_time_min ?? 4.2;
  const totalCost = metrics?.total_cost_usd ?? 7.40;
  const solarAvail = metrics?.solar_power_kw ?? 80.0;
  const gridOverloads = metrics?.grid_overload_count ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 font-sans">
      
      {/* 1. Power Grid Transformer Load */}
      <div className="glass-panel p-4 sm:p-5 border border-[#202F49] flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white font-semibold text-xs sm:text-sm">
            <div className="w-7 h-7 bg-[#162238] text-[#38BDF8] flex items-center justify-center border border-[#253755]">
              <Zap className="w-3.5 h-3.5 text-[#38BDF8]" />
            </div>
            <span>Transformer Load</span>
          </div>
          <span className={`px-2.5 py-0.5 text-[10px] font-mono font-bold border flex items-center gap-1 ${statusColor}`}>
            {statusIcon}
            <span>{status}</span>
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-baseline font-mono text-xs">
            <span className="text-zinc-400 text-[11px]">Load / Max</span>
            <span className="text-white font-bold text-sm">
              {Math.round(currentLoad)} <span className="text-zinc-500 text-xs font-normal">/ {maxCapacity} kW</span>
            </span>
          </div>
          
          <div className="w-full bg-[#0D1526] h-2 overflow-hidden border border-[#202F49]">
            <div
              className={`h-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(100, loadPct)}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-zinc-400 font-mono pt-0.5">
            <span>Utilization: <strong className="text-white">{loadPct}%</strong></span>
            <span>Headroom: <strong className="text-[#38BDF8]">{Math.round(headroom)} kW</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Renewable Solar Generation */}
      <div className="glass-panel p-4 sm:p-5 border border-[#202F49] flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white font-semibold text-xs sm:text-sm">
            <div className="w-7 h-7 bg-[#162238] text-[#38BDF8] flex items-center justify-center border border-[#253755]">
              <Sun className="w-3.5 h-3.5 text-[#38BDF8]" />
            </div>
            <span>Solar Generation</span>
          </div>
        </div>

        <div className="space-y-2 font-mono">
          <div className="flex items-baseline justify-between">
            <span className="text-zinc-400 text-[11px] font-sans">Output</span>
            <span className="text-xl font-bold text-white">{solarAvail} kW</span>
          </div>

          <div className="p-2.5 bg-[#162238] border border-[#202F49] text-[11px] flex justify-between items-center text-[#38BDF8]">
            <span className="font-sans text-zinc-400">Zero-Emission</span>
            <span className="font-sans">
              Spikes: <strong className={gridOverloads > 0 ? "text-[#EF4444] font-mono" : "text-[#38BDF8] font-mono"}>{gridOverloads}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Fleet Energy Telemetry */}
      <div className="glass-panel p-4 sm:p-5 border border-[#202F49] flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white font-semibold text-xs sm:text-sm">
            <div className="w-7 h-7 bg-[#162238] text-[#38BDF8] flex items-center justify-center border border-[#253755]">
              <Gauge className="w-3.5 h-3.5 text-[#38BDF8]" />
            </div>
            <span>Fleet Metrics</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 bg-[#162238] border border-[#202F49]">
            <span className="text-[10px] text-zinc-400 block uppercase font-sans">Avg Wait</span>
            <span className="text-base font-bold text-white">{typeof avgWait === 'number' ? avgWait.toFixed(1) : avgWait}m</span>
          </div>
          <div className="p-2 bg-[#162238] border border-[#202F49]">
            <span className="text-[10px] text-zinc-400 block uppercase font-sans">Avg Cost</span>
            <span className="text-base font-bold text-white">₹{typeof totalCost === 'number' ? (totalCost * 80).toFixed(0) : totalCost}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
