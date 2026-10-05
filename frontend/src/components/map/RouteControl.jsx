import React, { useState } from 'react';
import { Route, Navigation, ArrowRight, Clock, Gauge, RotateCcw, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { getRoute } from '../../services/osmApi';

export default function RouteControl({
  origin,
  destination,
  activeRoute,
  onRouteCalculated,
  onClearRoute,
  onSwapPoints,
  onSelectPreset
}) {
  const [loading, setLoading] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const originLat = origin?.lat ?? origin?.latitude;
  const originLng = origin?.lng ?? origin?.longitude ?? origin?.lon;
  const destLat = destination?.lat ?? destination?.latitude;
  const destLng = destination?.lng ?? destination?.longitude ?? destination?.lon;

  const canCalculate = Boolean(
    typeof originLat === 'number' &&
    typeof originLng === 'number' &&
    typeof destLat === 'number' &&
    typeof destLng === 'number'
  );

  const handleCalculateRoute = async () => {
    if (!canCalculate) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const data = await getRoute(originLat, originLng, destLat, destLng);
      if (data && data.coordinates && data.coordinates.length > 0) {
        if (onRouteCalculated) {
          onRouteCalculated(data);
        }
      } else {
        setErrorMsg('Could not find road path between selected points.');
      }
    } catch (err) {
      console.error('Route calculation error:', err);
      setErrorMsg('Route service unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Quick corridor test pairs
  const PRESET_ROUTES = [
    {
      label: 'MG Road → Electronic City',
      origin: { name: 'Tata Power - MG Road Metro Hub', lat: 12.9756, lng: 77.6066, id: 'CS-METRO' },
      destination: { name: 'Zeon EV - Electronic City Fast Hub', lat: 12.8452, lng: 77.6602, id: 'CS-SOUTH' }
    },
    {
      label: 'Hebbal → Whitefield',
      origin: { name: 'Kazam EV - Hebbal Tech Park', lat: 13.0358, lng: 77.5970, id: 'CS-NORTH' },
      destination: { name: 'ChargeZone EV - Whitefield', lat: 12.9863, lng: 77.7344, id: 'STATION-CHARGEZONE-WHITEFIELD' }
    }
  ];

  return (
    <div className="bg-[#131B2B] border border-[#202F49] p-4 space-y-3 font-sans shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#202F49] pb-2 text-xs">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-[#38BDF8]" />
          <strong className="text-white uppercase tracking-wider font-semibold">
            OSRM Road Routing Engine
          </strong>
        </div>
        {activeRoute && (
          <button
            type="button"
            onClick={onClearRoute}
            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear Route</span>
          </button>
        )}
      </div>

      {/* Origin & Destination Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Origin */}
        <div className="p-2.5 bg-[#0F172A] border border-[#202F49] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
            <span className="uppercase tracking-wider">Start Origin (A)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="truncate font-medium text-white text-[11px]">
            {origin ? (
              origin.name || `(${originLat.toFixed(4)}°, ${originLng.toFixed(4)}°)`
            ) : (
              <span className="text-slate-500 italic">Click station or map to set Origin</span>
            )}
          </div>
        </div>

        {/* Destination */}
        <div className="p-2.5 bg-[#0F172A] border border-[#202F49] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
            <span className="uppercase tracking-wider">Destination Hub (B)</span>
            <span className="w-2 h-2 rounded-full bg-[#38BDF8]"></span>
          </div>
          <div className="truncate font-medium text-white text-[11px]">
            {destination ? (
              destination.name || `(${destLat.toFixed(4)}°, ${destLng.toFixed(4)}°)`
            ) : (
              <span className="text-slate-500 italic">Click station or map to set Destination</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Test Corridor Presets */}
      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
        <span className="text-slate-400">Quick Route Demos:</span>
        {PRESET_ROUTES.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPreset && onSelectPreset(preset.origin, preset.destination)}
            className="px-2 py-0.5 bg-[#162238] hover:bg-[#1E2D4A] text-slate-300 hover:text-[#38BDF8] border border-[#202F49] hover:border-[#38BDF8]/40 transition-colors cursor-pointer"
          >
            ⚡ {preset.label}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleCalculateRoute}
          disabled={!canCalculate || loading}
          className={`flex-1 py-2 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-md ${
            canCalculate && !loading
              ? 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#2563EB] hover:to-[#3B82F6] text-white border-[#3B82F6]'
              : 'bg-[#1E293B] text-slate-500 border-[#202F49] cursor-not-allowed opacity-60'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Calculating OSRM Route...</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>Get Road Directions (OSRM)</span>
            </>
          )}
        </button>

        {onSwapPoints && origin && destination && (
          <button
            type="button"
            onClick={onSwapPoints}
            title="Swap Origin & Destination"
            className="p-2 bg-[#162238] hover:bg-[#1E2D4A] text-slate-300 hover:text-white border border-[#202F49] text-xs transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="text-[11px] text-rose-300 bg-[#2A1616] border border-rose-800 p-2">
          {errorMsg}
        </div>
      )}

      {/* Active Route Statistics Banner */}
      {activeRoute && (
        <div className="p-3 bg-[#0E1624] border border-[#2563EB] space-y-2">
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 p-2 bg-[#131B2B] border border-[#202F49]">
              <Gauge className="w-4 h-4 text-[#38BDF8] shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block font-sans uppercase">Road Distance</span>
                <strong className="text-base text-white font-bold">{activeRoute.distance_km} km</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-[#131B2B] border border-[#202F49]">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block font-sans uppercase">Estimated Time</span>
                <strong className="text-base text-white font-bold">{activeRoute.duration_min} min</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#202F49]">
            <span className="font-mono text-[10px] text-[#38BDF8]">
              Engine: {activeRoute.source || 'OSRM Driving Engine'}
            </span>
            {activeRoute.steps && activeRoute.steps.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSteps(!showSteps)}
                className="text-[#38BDF8] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{showSteps ? 'Hide Maneuvers' : 'Show Maneuvers'}</span>
                {showSteps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {showSteps && activeRoute.steps && (
            <ul className="text-[11px] text-slate-300 space-y-1 pt-1 font-sans pl-2 list-disc list-inside">
              {activeRoute.steps.map((st, i) => (
                <li key={i} className="truncate">{st}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
