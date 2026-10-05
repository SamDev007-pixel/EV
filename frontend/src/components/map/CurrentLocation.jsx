import React, { useState } from 'react';
import { Crosshair, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function CurrentLocation({ onLocationFound }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successCoords, setSuccessCoords] = useState(null);

  const handleGetLocation = () => {
    setErrorMsg(null);
    setSuccessCoords(null);

    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        const { latitude, longitude, accuracy } = pos.coords;
        setSuccessCoords({ lat: latitude, lng: longitude, accuracy });
        if (onLocationFound) {
          onLocationFound({
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy)
          });
        }
      },
      (err) => {
        setLoading(false);
        let message = 'Unable to retrieve your location.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location access was denied. Please allow location permissions in your browser settings.';
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'Location information is currently unavailable.';
            break;
          case err.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
          default:
            message = err.message || message;
        }
        setErrorMsg(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  return (
    <div className="flex flex-col items-end gap-1.5 font-sans">
      <button
        type="button"
        onClick={handleGetLocation}
        disabled={loading}
        title="Acquire current device location via browser Geolocation API"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#162238] hover:bg-[#1E2D4A] active:bg-[#2563EB] text-[#38BDF8] hover:text-white border border-[#202F49] hover:border-[#38BDF8]/60 text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#38BDF8]" />
        ) : (
          <Crosshair className="w-3.5 h-3.5 text-[#38BDF8]" />
        )}
        <span>{loading ? 'Locating...' : 'Use My Location'}</span>
      </button>

      {errorMsg && (
        <div className="max-w-xs text-[11px] text-rose-300 bg-[#2A1616] border border-rose-800 p-2 flex items-start gap-1.5 shadow-md">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successCoords && (
        <div className="text-[10px] font-mono text-emerald-300 bg-[#0E201B] border border-emerald-800 px-2 py-0.5 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Located: ({successCoords.lat.toFixed(4)}°, {successCoords.lng.toFixed(4)}°)</span>
        </div>
      )}
    </div>
  );
}
