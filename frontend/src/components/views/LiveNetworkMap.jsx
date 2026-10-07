import React, { useState } from 'react';
import { MapView, CurrentLocation } from '../map';
import { Navigation, Zap, CheckCircle2, Shield, Info } from 'lucide-react';
import { KeyValueGrid, StatTile } from '../common';

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

  const operationalCount = stations.filter((s) => s.operating_status === 'OPERATIONAL').length;
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
    <section className="ai-card section space-y-4 font-sans">
      <div className="section-head">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
            <Navigation className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="section-title">Charging network map</h3>
            <p className="section-desc">
              Station coordinates come from the local dataset snapshot; status and vehicle positions come
              from the simulation.
            </p>
          </div>
        </div>
        <CurrentLocation onLocationFound={handleLocationFound} />
      </div>

      {/* Measured counts, straight from the environment snapshot */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Stations in dataset" value={stations.length} size="sm" />
        <StatTile label="Operational now" value={operationalCount} tone="success" size="sm" />
        <StatTile label="Chargers modelled" value={totalChargers} tone="primary" size="sm" />
        <StatTile label="Vehicles in simulation" value={evs.length} size="sm" />
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-blue-600 border border-white rounded-full shadow-xs" />
          <span>Station (Operational)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-rose-600 border border-white rounded-full shadow-xs" />
          <span>Station (Fault)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-slate-700 rounded-full border border-white shadow-xs" />
          <span>Fleet EV</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
          <span>Browser location</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
          <span>User pin</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setCustomMarkers([]);
            setSelectedNode(null);
          }}
          disabled={customMarkers.length === 0}
          className="btn-ghost btn-sm ml-auto"
        >
          Clear user pins
        </button>
      </div>

      {selectedNode && (
        <div className="ai-card-flat space-y-2">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-semibold text-slate-900">{selectedNode.name || selectedNode.id}</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setSelectedNode(null)}>
              Close
            </button>
          </div>
          <KeyValueGrid
            columns={2}
            items={[
              {
                term: 'Coordinates',
                value: `${(selectedNode.lat ?? selectedNode.latitude)?.toFixed?.(4) ?? '—'}, ${
                  (selectedNode.lng ?? selectedNode.longitude)?.toFixed?.(4) ?? '—'
                }`,
                mono: true,
              },
              ...(selectedNode.charging_power !== undefined
                ? [
                    {
                      term: 'Rated Power',
                      value: `${Number(selectedNode.charging_power).toFixed(0)} kW`,
                    },
                  ]
                : []),
              ...(selectedNode.operating_status
                ? [
                    {
                      term: 'Operating Status',
                      value: selectedNode.operating_status,
                    },
                  ]
                : []),
              ...(selectedNode.soc !== undefined
                ? [
                    {
                      term: 'State of Charge',
                      value: `${Math.round(selectedNode.soc <= 1 ? selectedNode.soc * 100 : selectedNode.soc)}%`,
                    },
                  ]
                : []),
              ...(selectedNode.accuracy !== undefined
                ? [
                    {
                      term: 'Reported accuracy',
                      value:
                        typeof selectedNode.accuracy === 'number'
                          ? `${selectedNode.accuracy.toFixed(0)} m`
                          : String(selectedNode.accuracy),
                      mono: true,
                    },
                  ]
                : []),
            ]}
          />
          {selectedNode.isCustomPin && (
            <p className="text-xs text-slate-500">
              User pin created in the browser; it is not stored on the server.
            </p>
          )}
        </div>
      )}

      {/* Station table: the same source of truth the search algorithms read */}
      <div className="ai-table-container">
        <table className="ai-table">
          <thead>
            <tr>
              <th>Station</th>
              <th>Operator</th>
              <th className="num">Power</th>
              <th className="num">Chargers free</th>
              <th className="num">Tariff</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((st) => {
              const available = (st.chargers || []).filter((c) => c.current_status === 'AVAILABLE').length;
              return (
                <tr key={st.id}>
                  <td>
                    <div className="font-medium text-slate-900">{st.name}</div>
                    <div className="col-code">{st.id}</div>
                  </td>
                  <td className="text-slate-600">{st.operator_name || '—'}</td>
                  <td className="num">{st.charging_power ? `${Number(st.charging_power).toFixed(0)} kW` : '—'}</td>
                  <td className="num">
                    <span className="inline-flex items-center gap-1">
                      <Zap className="h-3 w-3 text-blue-600" />
                      {available}/{st.chargers?.length || 0}
                    </span>
                  </td>
                  <td className="num">
                    {typeof st.energy_price === 'number' ? `$${Number(st.energy_price).toFixed(3)}/kWh` : '—'}
                  </td>
                  <td>
                    {st.operating_status === 'OPERATIONAL' ? (
                      <span className="badge-emerald">
                        <CheckCircle2 className="h-3 w-3" /> Operational
                      </span>
                    ) : (
                      <span className="badge-rose">
                        <Shield className="h-3 w-3" /> {st.operating_status}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        Station metadata is a static public-dataset snapshot (location, operator, ports, published tariff).
        Occupancy, faults and vehicle positions are simulated. No external map, geocoding or routing API is called.
      </p>
    </section>
  );
}
