import React, { useState, useEffect } from 'react';
import { MapPin, Zap, Navigation, Trash2, X, BatteryCharging, ShieldAlert, CheckCircle2, Compass, Loader2 } from 'lucide-react';
import { reverseGeocode } from '../../services/osmApi';

export default function PlaceDetails({
  selectedNode,
  onClose,
  onSetOrigin,
  onSetDestination,
  onDeleteCustomMarker
}) {
  const [address, setAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

  useEffect(() => {
    if (!selectedNode) {
      setAddress(null);
      return;
    }

    const lat = selectedNode.latitude ?? selectedNode.lat;
    const lng = selectedNode.longitude ?? selectedNode.lng ?? selectedNode.lon;

    if (lat !== undefined && lng !== undefined) {
      // If node already has a full formatted address, use it
      if (selectedNode.display_name || selectedNode.address_text) {
        setAddress({
          display_name: selectedNode.display_name || selectedNode.address_text,
          city: selectedNode.city || '',
          state: selectedNode.state || ''
        });
        return;
      }

      setLoadingAddress(true);
      reverseGeocode(lat, lng)
        .then((res) => {
          setAddress(res);
        })
        .catch(() => {
          setAddress(null);
        })
        .finally(() => {
          setLoadingAddress(false);
        });
    }
  }, [selectedNode]);

  if (!selectedNode) return null;

  const lat = selectedNode.latitude ?? selectedNode.lat;
  const lng = selectedNode.longitude ?? selectedNode.lng ?? selectedNode.lon;
  const isStation = Boolean(selectedNode.charging_power_kw || selectedNode.total_ports || selectedNode.chargers || selectedNode.id?.startsWith('CS-') || selectedNode.id?.startsWith('STATION-'));
  const isEV = Boolean(selectedNode.batteryCapacity || selectedNode.battery_capacity_kwh || selectedNode.id?.startsWith('EV-') || selectedNode.id?.startsWith('SPIKE-'));
  const isCustomPin = selectedNode.isCustomPin || selectedNode.id?.startsWith('PIN-');

  return (
    <div className="bg-[#131B2B] border border-[#202F49] p-4 space-y-3 font-sans shadow-xl">
      {/* Title & Close Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#202F49] pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 flex items-center justify-center shrink-0 border ${
            isStation ? 'bg-[#162238] border-[#2563EB] text-[#38BDF8]' :
            isEV ? 'bg-[#1D322B] border-emerald-600 text-emerald-300' :
            'bg-[#2A1E14] border-amber-600 text-amber-300'
          }`}>
            {isStation ? <Zap className="w-4 h-4" /> : isEV ? <BatteryCharging className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-white font-bold text-sm leading-tight">
              {selectedNode.name || selectedNode.id || 'Selected Map Location'}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
              <span>{isStation ? 'EV Station Hub' : isEV ? 'Fleet EV Agent' : 'Geographic Coordinate'}</span>
              <span>•</span>
              <span className="text-[#38BDF8]">{selectedNode.id}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-[#1E2D4A] rounded cursor-pointer"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Reverse Geocoded Human-Readable Address */}
      <div className="p-2.5 bg-[#0F172A] border border-[#202F49] space-y-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-mono tracking-wider">
          <span className="flex items-center gap-1">
            <Compass className="w-3 h-3 text-[#38BDF8]" />
            <span>Nominatim Reverse Geocoded Address</span>
          </span>
          {loadingAddress && <Loader2 className="w-3 h-3 animate-spin text-[#38BDF8]" />}
        </div>
        <p className="text-white text-xs leading-relaxed font-sans">
          {loadingAddress ? (
            <span className="text-slate-400 italic">Querying Nominatim for street address...</span>
          ) : address?.display_name ? (
            address.display_name
          ) : selectedNode.address ? (
            selectedNode.address
          ) : (
            <span className="text-slate-400">Address resolved from OpenStreetMap coordinate plane.</span>
          )}
        </p>
      </div>

      {/* Geographic Coordinates Display */}
      {lat !== undefined && lng !== undefined && (
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 bg-[#0F172A] border border-[#202F49]">
            <span className="text-[10px] text-slate-400 block font-sans uppercase">Latitude</span>
            <strong className="text-white">{Number(lat).toFixed(5)}° N</strong>
          </div>
          <div className="p-2 bg-[#0F172A] border border-[#202F49]">
            <span className="text-[10px] text-slate-400 block font-sans uppercase">Longitude</span>
            <strong className="text-white">{Number(lng).toFixed(5)}° E</strong>
          </div>
        </div>
      )}

      {/* Station Specific Specs */}
      {isStation && (
        <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-[#0F172A] border border-[#202F49] p-2">
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Power</span>
            <strong className="text-[#38BDF8]">{selectedNode.charging_power_kw || selectedNode.chargingPower || 60} kW</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Tariff</span>
            <strong className="text-white">₹{selectedNode.price_per_kwh || selectedNode.pricePerKwh || 16.5}/kWh</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Status</span>
            <strong className="text-emerald-400">{selectedNode.status || selectedNode.operatingStatus || 'OPERATIONAL'}</strong>
          </div>
        </div>
      )}

      {/* EV Specific Specs */}
      {isEV && (
        <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-[#0F172A] border border-[#202F49] p-2">
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Battery SoC</span>
            <strong className="text-[#38BDF8]">{selectedNode.current_soc_percent || 30}%</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Priority</span>
            <strong className="text-amber-400">{selectedNode.priority || 'STANDARD'}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Deadline</span>
            <strong className="text-white">{selectedNode.departureDeadline || 90}m</strong>
          </div>
        </div>
      )}

      {/* Action Buttons for Routing & Custom Pin Deletion */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#202F49] flex-wrap">
        {onSetOrigin && (
          <button
            type="button"
            onClick={() => onSetOrigin({ ...selectedNode, lat, lng })}
            className="flex-1 py-1.5 px-3 bg-[#162238] hover:bg-[#1E2D4A] text-[#38BDF8] hover:text-white border border-[#202F49] hover:border-[#38BDF8] text-xs font-semibold transition-all cursor-pointer text-center"
          >
            Set as Route Origin (A)
          </button>
        )}

        {onSetDestination && (
          <button
            type="button"
            onClick={() => onSetDestination({ ...selectedNode, lat, lng })}
            className="flex-1 py-1.5 px-3 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#2563EB] hover:to-[#3B82F6] text-white border border-[#3B82F6] text-xs font-bold transition-all cursor-pointer text-center shadow-sm"
          >
            Set as Destination (B)
          </button>
        )}

        {isCustomPin && onDeleteCustomMarker && (
          <button
            type="button"
            onClick={() => onDeleteCustomMarker(selectedNode.id)}
            className="p-1.5 bg-[#2A1616] hover:bg-[#3D1E1E] text-rose-300 border border-rose-800 text-xs transition-colors cursor-pointer"
            title="Delete this custom pin"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
