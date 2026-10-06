import React, { useState } from 'react';
import { MapView, CurrentLocation } from '../map';
import { Navigation, MapPin, Zap, CheckCircle2, Shield, Info } from 'lucide-react';

/**
 * Station network map.
 *
 * Data sources:
 *  - station records come from the backend environment snapshot (/api/state -> data_sources
 *    "station_metadata": a static public dataset snapshot shipped with the repository);
 *  - EV positions and station status come from the deterministic simulation;
 *  - pins dropped by the user are user input, held in component state only.
 *
 * The map canvas renders with Leaflet; no external geocoding, routing or POI service is
 * queried, so the screen works fully offline.
 */
export default function LiveNetworkMap({ stations = [], evs = [] }) {
  const [customMarkers, setCustomMarkers] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const operationalCount = stations.filter((s) => s.operatingStatus === 'OPERATIONAL').length;
  const totalChargers = stations.reduce((acc, s) => acc + (s.chargers?.length || 0), 0);

  const handleMapClick = ({ lat, lng }) => {
    const pinNumber = customMarkers.length + 1;
    const newPin = {
      id: `PIN-${pinNumber}`,
      name: `User pin #${pinNumber}`,
      lat,
      lng,
      latitude: lat,
      longitude: lng,
      isCustomPin: true,
    };
    setCustomMarkers((prev) => [...prev, newPin]);
    setSelectedNode(newPin);
  };

  const handleLocationFound = (loc) => {
    setCurrentLocation(loc);
    setSelectedNode({
      id: 'MY-LOCATION',
      name: 'Browser-reported location',
      lat: loc.lat,
      lng: loc.lng,
      latitude: loc.lat,
      longitude: loc.lng,
      accuracy: loc.accuracy,
    });
  };

  return (
    <div className="ai-card p-4 sm:p-5 space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0 rounded-md">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
              Charging Network Map
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Station coordinates from the local dataset snapshot; status and vehicle positions from the simulation.
            </p>
          </div>
        </div>
        <CurrentLocation onLocationFound={handleLocationFound} />
      </div>

      {/* Measured counts, straight from the environment snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="bg-slate-50 border border-slate-200 rounded-md py-2">
          <div className="text-base font-bold text-slate-900">{stations.length}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Stations in dataset</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-md py-2">
          <div className="text-base font-bold text-emerald-700">{operationalCount}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Operational now</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-md py-2">
          <div className="text-base font-bold text-blue-700">{totalChargers}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Chargers modelled</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-md py-2">
          <div className="text-base font-bold text-slate-900">{evs.length}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Vehicles in simulation</div>
        </div>
      </div>

      <MapView
        stations={stations}
        evs={evs}
        customMarkers={customMarkers}
        currentLocation={currentLocation}
        onMapClick={handleMapClick}
        onSelectNode={setSelectedNode}
        selectedNodeId={selectedNode?.id}
      />

      <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-blue-700 border border-white rounded-sm" />
          <span>Charging station</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
          <span>Browser location</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
          <span>User pin</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setCustomMarkers([]);
            setSelectedNode(null);
          }}
          className="ml-auto text-[11px] font-medium text-slate-500 hover:text-slate-800 underline"
        >
          Clear user pins
        </button>
      </div>

      {selectedNode && (
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-700 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">{selectedNode.name}</span>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-700"
              onClick={() => setSelectedNode(null)}
            >
              Close
            </button>
          </div>
          <div className="font-mono text-[11px] text-slate-600">
            lat {(selectedNode.lat ?? selectedNode.latitude)?.toFixed?.(4) ?? '—'}, lng{' '}
            {(selectedNode.lng ?? selectedNode.longitude)?.toFixed?.(4) ?? '—'}
          </div>
          {selectedNode.isCustomPin && (
            <p className="text-[11px] text-slate-500">
              User pin created in the browser; it is not stored on the server.
            </p>
          )}
        </div>
      )}

      {/* Station table: the same source of truth the search algorithms read */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">Station</th>
              <th className="py-2 pr-3">Operator</th>
              <th className="py-2 pr-3">Power</th>
              <th className="py-2 pr-3">Chargers</th>
              <th className="py-2 pr-3">Price</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => {
              const available = (s.chargers || []).filter((c) => c.currentStatus === 'AVAILABLE').length;
              return (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-slate-900">{s.name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{s.id}</div>
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{s.operatorName || '—'}</td>
                  <td className="py-2 pr-3 text-slate-600">{s.chargingPower ? `${s.chargingPower} kW` : '—'}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Zap className="w-3 h-3 text-blue-600" />
                      {available}/{s.chargers?.length || 0} free
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {typeof s.energyPrice === 'number' ? `$${s.energyPrice.toFixed(3)}/kWh` : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    {s.operatingStatus === 'OPERATIONAL' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Operational
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                        <Shield className="w-3 h-3" /> {s.operatingStatus}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
        Station metadata is a static public-dataset snapshot (location, operator, ports, published tariff).
        Occupancy, faults and vehicle positions are simulated. No external map, geocoding or routing API is called.
      </p>
    </div>
  );
}
