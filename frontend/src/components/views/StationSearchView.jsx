import React, { useState } from 'react';
import { Compass, MapPin, Zap, ArrowRight, Search, Filter } from 'lucide-react';
import LiveNetworkMap from './LiveNetworkMap';
import { PageHeader, Section, StatTile, StateBlock } from '../common';

const CHARGER_TYPES = ['DC_FAST', 'ULTRA_FAST', 'AC_SLOW'];

function chargerTypesOf(station) {
  if (Array.isArray(station.charger_types) && station.charger_types.length > 0) {
    return station.charger_types;
  }
  return Array.from(new Set((station.chargers || []).map((c) => c.charger_type))).filter(Boolean);
}

export default function StationSearchView({ stations = [], evs = [], onSelectTab }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConnector, setSelectedConnector] = useState('ALL');
  const [selectedStation, setSelectedStation] = useState(null);

  const query = searchQuery.trim().toLowerCase();

  const filteredStations = stations.filter((st) => {
    const haystack = [st.name, st.id, st.address, st.operator_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (selectedConnector === 'ALL') return true;
    return chargerTypesOf(st).includes(selectedConnector);
  });

  const operational = stations.filter((s) => s.operating_status === 'OPERATIONAL').length;
  const totalChargers = stations.reduce((acc, s) => acc + (s.chargers?.length || 0), 0);
  const freeChargers = stations.reduce(
    (acc, s) => acc + (s.chargers || []).filter((c) => c.current_status === 'AVAILABLE').length,
    0
  );

  return (
    <div className="page">

      <PageHeader
        eyebrow="Pipeline · stage 3"
        title="Charging station network"
        description="The candidate set that the search algorithms explore: station locations, supported charger types, live bay availability, published tariff and queue state."
        actions={
          <button
            type="button"
            onClick={() => onSelectTab('search_comparison')}
            className="btn-primary"
          >
            Compare search algorithms
            <ArrowRight className="h-4 w-4" />
          </button>
        }
      />

      <div className="stat-grid">
        <StatTile label="Stations" value={stations.length} hint="Records in the environment snapshot" />
        <StatTile
          label="Operational"
          value={operational}
          tone="success"
          hint={`${stations.length - operational} degraded, overloaded or faulted`}
        />
        <StatTile
          label="Chargers modelled"
          value={totalChargers}
          hint={`${freeChargers} currently available`}
        />
        <StatTile label="Vehicles in simulation" value={evs.length} />
      </div>

      <Section
        title="Filter stations"
        description="Filtering happens on the loaded snapshot and does not call the backend again."
      >
        <div className="toolbar">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, code, operator or address…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pl-9"
              aria-label="Search stations"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              Charger type
            </span>
            <select
              value={selectedConnector}
              onChange={(e) => setSelectedConnector(e.target.value)}
              className="form-input w-auto"
              aria-label="Filter by charger type"
            >
              <option value="ALL">All types</option>
              {CHARGER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-end">
            <span className="text-xs text-slate-500">
              {filteredStations.length} of {stations.length} shown
            </span>
            {(searchQuery || selectedConnector !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedConnector('ALL');
                }}
                className="btn-secondary btn-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Map column: LiveNetworkMap renders its own card, so no extra wrapper here. */}
        <div className="min-w-0">
          <LiveNetworkMap stations={stations} evs={evs} />
        </div>

        {/* Station list */}
        <Section
          title={`Stations (${filteredStations.length})`}
          description="Free bay counts and charger types come from the same records the solver reads."
        >
          {filteredStations.length === 0 ? (
            <StateBlock
              variant="empty"
              title="No station matches the filter"
              detail={
                query
                  ? `Nothing matched “${searchQuery}” with the selected charger type.`
                  : 'No station includes the selected charger type.'
              }
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedConnector('ALL');
                  }}
                  className="btn-secondary btn-sm"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredStations.map((station) => {
                const chargers = station.chargers || [];
                const totalBays = chargers.length || station.number_of_chargers || 0;
                const freeBays = chargers.filter((c) => c.current_status === 'AVAILABLE').length;
                const isSelected = selectedStation?.id === station.id;
                const isOperational = station.operating_status === 'OPERATIONAL';
                const queueLength = (station.current_queue || []).length;
                const types = chargerTypesOf(station);

                return (
                  <button
                    key={station.id}
                    type="button"
                    onClick={() => setSelectedStation(isSelected ? null : station)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-400 bg-blue-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="col-code badge-slate">{station.id}</span>
                          <h3 className="truncate text-sm font-bold text-slate-900">
                            {station.name}
                          </h3>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="truncate">
                            {station.address ||
                              (station.location
                                ? `Grid position (${Number(station.location.x).toFixed(1)}, ${Number(station.location.y).toFixed(1)})`
                                : 'Location unavailable')}
                          </span>
                        </p>
                      </div>
                      <span className={isOperational ? 'badge-emerald' : 'badge-rose'}>
                        {station.operating_status}
                      </span>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 sm:grid-cols-4">
                      <div>
                        <dt className="kv-term">Capacity</dt>
                        <dd className="kv-value font-mono">
                          {Number(station.charging_power ?? 0).toFixed(0)} kW
                        </dd>
                      </div>
                      <div>
                        <dt className="kv-term">Bays free</dt>
                        <dd className="kv-value font-mono">
                          {freeBays}/{totalBays}
                        </dd>
                      </div>
                      <div>
                        <dt className="kv-term">Queue</dt>
                        <dd className="kv-value font-mono">{queueLength} waiting</dd>
                      </div>
                      <div>
                        <dt className="kv-term">Tariff</dt>
                        <dd className="kv-value font-mono">
                          {station.energy_price !== undefined
                            ? `$${Number(station.energy_price).toFixed(3)}/kWh`
                            : '—'}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="kv-term">Charger types</span>
                      {types.length === 0 ? (
                        <span className="text-2xs text-slate-400">not reported</span>
                      ) : (
                        types.map((t) => (
                          <span key={t} className="badge-slate font-mono">
                            {t}
                          </span>
                        ))
                      )}
                      {station.operator_name && (
                        <span className="ml-auto text-2xs text-slate-400">
                          {station.operator_name}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

      </div>

      <Section
        title="How the search uses this data"
        description="Stage 3 supplies the nodes and edge costs that stage 4 explores."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            [
              'Nodes',
              'Every operational station becomes a goal candidate; a faulted station is removed from the graph.'
            ],
            [
              'Edge cost',
              'Distances between positions are weighted together with waiting time and tariff into the step cost.'
            ],
            [
              'Heuristic',
              'Straight-line distance to the request destination is used as the admissible estimate for A* and greedy search.'
            ]
          ].map(([title, text]) => (
            <div key={title} className="rounded-md border border-slate-200 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Zap className="h-3.5 w-3.5 text-blue-600" />
                {title}
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-slate-500">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-1.5 text-2xs leading-relaxed text-slate-400">
          <Compass className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            Station metadata is a static public-dataset snapshot shipped with the repository;
            occupancy, queue state and faults are produced by the deterministic simulation. No
            external map, geocoding or routing service is contacted.
          </span>
        </p>
      </Section>

    </div>
  );
}
