import React from 'react';
import { BatteryCharging, AlertOctagon, CheckCircle2, Zap, Power } from 'lucide-react';

export default function StationCard({ station, onToggleFault }) {
  if (!station) return null;

  const status = station.operatingStatus || station.status || 'OPERATIONAL';
  const isFaulty = status === 'FAULT';

  const totalPorts = station.totalChargers ?? station.total_ports ?? 4;
  const price = station.pricePerKwh ?? station.price_per_kwh ?? 18.5;
  const chargersList = station.chargers || station.ports || [];

  const totalDraw = chargersList.reduce((sum, c) => {
    const pwr = c.activePower ?? c.active_power_kw ?? 0;
    return sum + pwr;
  }, 0);

  const availablePortsCount = chargersList.filter(
    c => (c.currentStatus || c.current_status) === 'AVAILABLE'
  ).length;

  return (
    <div className={`glass-panel border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 font-sans ${
      isFaulty 
        ? 'border-[#EF4444]/60 bg-[#1A1215] shadow-lg shadow-red-950/20' 
        : 'border-[#202F49] hover:border-[#3B82F6]/60 shadow-md'
    }`}>
      
      {/* Station Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 flex items-center justify-center shrink-0 border ${
              isFaulty ? 'bg-[#2B1115] border-[#EF4444]/40 text-[#EF4444]' : 'bg-[#162238] border-[#253755] text-[#38BDF8]'
            }`}>
              <BatteryCharging className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base leading-tight">
                {station.name || station.id}
              </h3>
              <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
                {station.location_name || `Location: (${station.location?.x ?? station.location_x ?? 0}, ${station.location?.y ?? station.location_y ?? 0})`}
              </p>
            </div>
          </div>

          <span className={`px-2.5 py-0.5 text-[10px] font-mono font-semibold flex items-center gap-1 border shrink-0 ${
            isFaulty 
              ? 'bg-[#2B1115] text-[#EF4444] border-[#EF4444]/60' 
              : 'bg-[#162238] text-[#38BDF8] border-[#253755]'
          }`}>
            {isFaulty ? <AlertOctagon className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3 text-[#38BDF8]" />}
            {status}
          </span>
        </div>

        {/* Station Stats Strip */}
        <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-[#131B2B] border border-[#202F49] mb-3 text-xs">
          <div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Available</span>
            <strong className="text-white font-mono text-sm">
              {isFaulty ? 0 : availablePortsCount}<span className="text-zinc-400 text-xs font-normal">/{totalPorts}</span>
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Live Draw</span>
            <strong className="text-[#38BDF8] font-mono text-sm">{Math.round(totalDraw)} kW</strong>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Tariff</span>
            <strong className="text-white font-mono text-sm">₹{price}</strong>
          </div>
        </div>

        {/* Individual Charging Ports Grid */}
        <div className="space-y-1.5 mb-4">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block px-1">
            Charger Bays
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {chargersList.map((charger, idx) => {
              const cStatus = (charger.currentStatus || charger.current_status || 'AVAILABLE').toUpperCase();
              const isOccupied = cStatus === 'CHARGING' || cStatus === 'OCCUPIED';
              const pwr = charger.maxPowerKw || charger.max_power_kw || 50;
              const evAssigned = charger.currentEvId || charger.current_ev_id;

              return (
                <div
                  key={charger.id || idx}
                  className={`p-2 border text-[11px] font-sans flex items-center justify-between ${
                    isFaulty
                      ? 'bg-[#181215] border-[#4A1D24] text-zinc-500'
                      : isOccupied
                      ? 'bg-[#1A2D4F] border-[#2563EB] text-white shadow-sm'
                      : 'bg-[#131B2B] border-[#202F49] text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Zap className={`w-3 h-3 shrink-0 ${isOccupied ? 'text-[#38BDF8]' : 'text-zinc-400'}`} />
                    <span className="font-mono text-[10px] truncate">Bay {idx + 1} ({pwr}kW)</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 shrink-0 ${
                    isOccupied ? 'text-[#38BDF8] font-bold' : 'text-zinc-400'
                  }`}>
                    {isOccupied ? (evAssigned || 'In-Use') : 'Free'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="pt-2.5 border-t border-[#202F49] flex items-center justify-between">
        <span className="text-[11px] text-zinc-400 font-sans">
          Station Hub ID: <span className="font-mono text-[#38BDF8]">{station.id}</span>
        </span>
        <button
          onClick={() => onToggleFault(station.id, !isFaulty)}
          className={`px-3 py-1 text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
            isFaulty
              ? 'bg-[#162238] hover:bg-[#1E2D4A] text-[#38BDF8] border-[#202F49]'
              : 'bg-[#2B1115] hover:bg-[#3D181E] text-[#EF4444] border border-[#6B1D26] hover:border-[#EF4444]'
          }`}
        >
          <Power className="w-3 h-3" />
          <span>{isFaulty ? 'Restore Hub' : 'Simulate Fault'}</span>
        </button>
      </div>

    </div>
  );
}
