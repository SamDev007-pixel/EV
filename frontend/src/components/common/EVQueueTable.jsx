import { Car } from 'lucide-react';

export default function EVQueueTable({ evs }) {
  if (!evs || evs.length === 0) {
    return (
      <div className="glass-panel p-8 border border-[#12203D] text-center text-[#8FA0BE] font-sans">
        <Car className="w-8 h-8 mx-auto text-[#8FA0BE] mb-2" />
        <p className="text-xs">No active vehicle sessions registered in the fleet queue.</p>
      </div>
    );
  }

  const getUrgencyBadge = (priority) => {
    const p = String(priority || 'STANDARD').toUpperCase();
    if (p.includes('EMERGENCY') || p.includes('CRITICAL')) {
      return (
        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#1C0A0A] text-[#EF4444] border border-[#3D1414] uppercase tracking-wider inline-block">
          EMERGENCY
        </span>
      );
    } else if (p.includes('HIGH')) {
      return (
        <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold bg-[#0C1E3D] text-[#93C5FD] border border-[#1E4580] uppercase tracking-wider inline-block">
          HIGH
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[#060D1A] text-zinc-400 border border-[#14233D] uppercase tracking-wider inline-block">
        STANDARD
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const s = String(status || 'QUEUED').toUpperCase();
    switch (s) {
      case 'CHARGING':
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#0C1E3D] text-[#38BDF8] border border-[#1E4580] uppercase tracking-wider inline-block">
            CHARGING
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold bg-[#060D1A] text-zinc-300 border border-[#14233D] uppercase tracking-wider inline-block">
            COMPLETED
          </span>
        );
      case 'TIMED_OUT':
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold bg-[#1C0A0A] text-[#EF4444] border border-[#3D1414] uppercase tracking-wider inline-block">
            TIMED OUT
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-medium bg-[#131B2B] text-slate-400 border border-[#202F49] uppercase tracking-wider inline-block">
            QUEUED
          </span>
        );
    }
  };

  return (
    <div className="glass-panel border border-[#202F49] overflow-hidden font-sans shadow-md">
      <div className="px-5 py-3.5 bg-[#162238] border-b border-[#202F49] flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-white text-xs sm:text-sm">
          <Car className="w-4 h-4 text-[#38BDF8]" />
          <span>Fleet Queue</span>
        </div>
        <span className="text-xs font-mono text-[#38BDF8] font-bold">{evs.length} Vehicles</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#131B2B] border-b border-[#202F49] text-zinc-300 font-sans text-[11px]">
              <th className="py-3 px-4 font-semibold">Vehicle</th>
              <th className="py-3 px-4 font-semibold">Priority</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Battery SoC</th>
              <th className="py-3 px-4 font-semibold">Station</th>
              <th className="py-3 px-4 font-semibold">Wait Time</th>
              <th className="py-3 px-4 font-semibold">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#202F49] font-sans">
            {evs.map((ev) => {
              const cap = ev.batteryCapacity || 60.0;
              const curBat = ev.currentBatteryLevel ?? 0;
              const reqBat = ev.requiredBatteryLevel ?? cap;
              const curSoC = ev.current_soc_percent ?? Math.round((curBat / cap) * 100);
              const reqSoC = ev.target_soc_percent ?? Math.round((reqBat / cap) * 100);
              
              const priority = ev.priority || ev.urgency_level || 'STANDARD';
              const assignedStation = ev.assignedStationId || ev.assigned_station_id || null;
              const assignedCharger = ev.assignedChargerId || ev.assigned_port_id || null;
              const waitTime = ev.waitTimeMin ?? ev.wait_time_min ?? 0;
              const cost = ev.chargingCostUSD ?? ev.total_cost_usd ?? 0.0;

              return (
                <tr key={ev.id} className="hover:bg-[#162238]/70 transition-colors">
                  
                  {/* EV ID */}
                  <td className="py-3 px-4">
                    <span className="font-bold text-[#38BDF8] font-mono text-xs">{ev.id}</span>
                  </td>

                  {/* Urgency */}
                  <td className="py-3 px-4">
                    {getUrgencyBadge(priority)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    {getStatusBadge(ev.status)}
                  </td>

                  {/* Battery SoC Progress */}
                  <td className="py-3 px-4 w-44">
                    <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                      <span className="text-white font-semibold">{curSoC}%</span>
                      <span className="text-zinc-300">Target: {reqSoC}%</span>
                    </div>
                    <div className="w-full bg-[#0D1526] h-2 overflow-hidden border border-[#202F49]">
                      <div
                        className={`h-full transition-all duration-300 ${
                          ev.status === 'COMPLETED'
                            ? 'bg-zinc-500'
                            : curSoC < 20
                            ? 'bg-red-500'
                            : 'bg-gradient-to-r from-[#1D4ED8] to-[#38BDF8]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, curSoC))}%` }}
                      />
                    </div>
                  </td>

                  {/* Location */}
                  <td className="py-3 px-4">
                    {assignedStation ? (
                      <div>
                        <span className="text-white font-medium font-mono text-xs">{assignedStation}</span>
                        {assignedCharger && (
                          <span className="text-zinc-400 text-[10px] font-sans"> (Bay #{assignedCharger.replace(/.*-CH-/, '')})</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-500 italic text-[11px]">Unassigned</span>
                    )}
                  </td>

                  {/* Wait Time */}
                  <td className="py-3 px-4 text-zinc-300 font-mono text-xs">
                    {waitTime} min
                  </td>

                  {/* Cost */}
                  <td className="py-3 px-4 text-white font-mono font-medium text-xs">
                    ₹{(Number(cost) * 80).toFixed(0)}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
