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
        className="btn-secondary btn-sm"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Crosshair className="h-3.5 w-3.5" />
        )}
        <span>{loading ? 'Locating...' : 'Use My Location'}</span>
      </button>

      {errorMsg && (
        <div className="banner banner--error max-w-xs text-2xs">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successCoords && (
        <div className="badge-emerald font-mono">
          <CheckCircle2 className="h-3 w-3" />
          Located: ({successCoords.lat.toFixed(4)}°, {successCoords.lng.toFixed(4)}°)
        </div>
      )}
    </div>
  );
}
