import React, { useState } from 'react';
import {
  Compass,
  MapPin,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
  ArrowRight,
  Layers,
  Search
} from 'lucide-react';
import LiveNetworkMap from './LiveNetworkMap';

export default function StationSearchView({ stations = [], evs = [], onSelectTab }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConnector, setSelectedConnector] = useState('ALL');
  const [selectedStation, setSelectedStation] = useState(stations[0] || null);

  // Filter stations based on search query and connector
  const filteredStations = stations.filter(st => {
    const matchesQuery = st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         st.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (st.location_name && st.location_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesQuery) return false;

    if (selectedConnector === 'ALL') return true;
    return st.connectors && st.connectors.includes(selectedConnector);
  });

  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div className="ai-card p-5 bg-gradient-to-r from-blue-50/40 via-white to-slate-50 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-blue">SPATIAL HEURISTIC NETWORK</span>
              <span className="text-xs text-slate-500 font-mono">SEARCH CANDIDATES &amp; TOPOLOGY</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Charging Station Network &amp; Spatial Search
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              Explore physical hub topology, Euclidean distances, real-time bay availability, and estimated waiting 
              times feeding the graph search algorithms.
            </p>
          </div>

          <button
            onClick={() => onSelectTab('search_comparison')}
            className="btn-primary text-xs flex items-center gap-1.5 self-start md:self-center"
          >
            <span>Run Search Algorithm Comparison</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="ai-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search stations by name, code or zone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Connector:</span>
          </div>
          <select
            value={selectedConnector}
            onChange={(e) => setSelectedConnector(e.target.value)}
            className="form-input text-xs py-1.5"
          >
            <option value="ALL">All Connectors</option>
            <option value="CCS2">CCS2 (DC Fast)</option>
            <option value="Type 2">Type 2 (AC Normal)</option>
            <option value="CHAdeMO">CHAdeMO</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Station List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (6 Cols): Clean Map View */}
        <div className="lg:col-span-6 space-y-4">
          <div className="ai-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Spatial Topology Map</h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {stations.length} Hub Nodes
              </span>
            </div>

            <div className="h-[440px] rounded-lg overflow-hidden border border-slate-200">
              <LiveNetworkMap stations={stations} evs={evs} />
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Available Hub
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Occupied / Queued
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Grid Overload
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (6 Cols): Station Information List & Search Results */}
        <div className="lg:col-span-6 space-y-4">
          <div className="ai-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Station Search Results ({filteredStations.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Sorted by Admissible Distance
              </span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredStations.length > 0 ? (
                filteredStations.map((station) => {
                  const totalBays = station.chargers?.length || station.total_bays || 2;
                  const freeBays = Math.max(0, totalBays - (station.occupied_bays || 0));
                  const isSelected = selectedStation?.id === station.id;
                  const isOperational = station.status === 'AVAILABLE' || station.status === 'OPERATIONAL';
                  const waitTime = isOperational ? (station.queue_length || 0) * 15 : 999;

                  return (
                    <div
                      key={station.id}
                      onClick={() => setSelectedStation(station)}
                      className={`p-4 border rounded-lg transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {station.id}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">{station.name}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{station.location_name || `Coordinates (${station.x?.toFixed(1) || 0}, ${station.y?.toFixed(1) || 0})`}</span>
                          </p>
                        </div>

                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                          isOperational ? 'badge-emerald' : 'badge-rose'
                        }`}>
                          {station.status}
                        </span>
                      </div>

                      {/* Telemetrics Bar */}
                      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-1.5 bg-slate-50 rounded">
                          <span className="text-[10px] text-slate-400 block uppercase">Power</span>
                          <strong className="text-slate-800 font-mono">{station.max_power_kw || 150} kW</strong>
                        </div>
                        <div className="p-1.5 bg-slate-50 rounded">
                          <span className="text-[10px] text-slate-400 block uppercase">Free Bays</span>
                          <strong className="text-emerald-700 font-mono">{freeBays}/{totalBays}</strong>
                        </div>
                        <div className="p-1.5 bg-slate-50 rounded">
                          <span className="text-[10px] text-slate-400 block uppercase">Est. Wait</span>
                          <strong className="text-slate-800 font-mono">{waitTime} min</strong>
                        </div>
                        <div className="p-1.5 bg-slate-50 rounded">
                          <span className="text-[10px] text-slate-400 block uppercase">Tariff</span>
                          <strong className="text-blue-700 font-mono">${station.price_per_kwh || 0.28}/kWh</strong>
                        </div>
                      </div>

                      {/* Connectors Supported */}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Hardware:</span>
                        {(station.connectors || ['CCS2', 'Type 2']).map((c, i) => (
                          <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                            {c}
                          </span>
                        ))}
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <Compass className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-semibold text-slate-800">No Charging Stations Found</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No stations match your current search query &ldquo;{searchQuery}&rdquo; or connector filter &ldquo;{selectedConnector}&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSelectedConnector('ALL'); }}
                    className="btn-secondary text-xs inline-flex items-center gap-1.5"
                  >
                    <span>Clear All Filters</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
