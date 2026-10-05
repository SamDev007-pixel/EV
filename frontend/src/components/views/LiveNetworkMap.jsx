import React, { useState, useEffect } from 'react';
import {
  MapView,
  MapSearch,
  CurrentLocation,
  RouteControl,
  PlaceDetails,
  POIFilterControl
} from '../map';
import { Navigation, MapPin, Zap, Layers, Info, CheckCircle2, Shield } from 'lucide-react';
import { getNearbyPOIs } from '../../services/osmApi';

export default function LiveNetworkMap({ stations = [], evs = [] }) {
  // Application stations (guaranteeing fallback to real Bengaluru corridors if stations prop is empty)
  const activeStations = stations.length > 0 ? stations : [
    {
      id: 'CS-METRO',
      name: 'Tata Power - MG Road Central Metro EV Hub',
      latitude: 12.9756,
      longitude: 77.6066,
      charging_power_kw: 120.0,
      total_ports: 4,
      price_per_kwh: 18.5,
      status: 'OPERATIONAL'
    },
    {
      id: 'CS-NORTH',
      name: 'Kazam EV - Hebbal Tech Park Supercharger',
      latitude: 13.0358,
      longitude: 77.5970,
      charging_power_kw: 60.0,
      total_ports: 4,
      price_per_kwh: 16.0,
      status: 'OPERATIONAL'
    },
    {
      id: 'CS-SOUTH',
      name: 'Zeon EV - Electronic City Fast Hub',
      latitude: 12.8452,
      longitude: 77.6602,
      charging_power_kw: 150.0,
      total_ports: 4,
      price_per_kwh: 17.5,
      status: 'OPERATIONAL'
    },
    {
      id: 'STATION-CHARGEZONE-WHITEFIELD',
      name: 'ChargeZone EV Supercharger - Whitefield',
      latitude: 12.9863,
      longitude: 77.7344,
      charging_power_kw: 60.0,
      total_ports: 4,
      price_per_kwh: 16.5,
      status: 'OPERATIONAL'
    }
  ];

  // User interactive state
  const [customMarkers, setCustomMarkers] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [searchedLocation, setSearchedLocation] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);

  // Origin & Destination for OSRM Route Control
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [routeDestination, setRouteDestination] = useState(null);

  // Overpass POI Layer State
  const [showPOIs, setShowPOIs] = useState(false);
  const [poiCategory, setPoiCategory] = useState('all');
  const [pois, setPois] = useState([]);
  const [loadingPOIs, setLoadingPOIs] = useState(false);

  // Auto-set default Destination and Origin from active stations
  useEffect(() => {
    if (activeStations.length > 0) {
      if (!routeDestination) {
        const dest = activeStations[0];
        setRouteDestination({
          name: dest.name || dest.id,
          lat: dest.latitude || 12.9756,
          lng: dest.longitude || 77.6066,
          id: dest.id
        });
      }
      if (!routeOrigin && activeStations.length > 1) {
        const orig = activeStations[1];
        setRouteOrigin({
          name: orig.name || orig.id,
          lat: orig.latitude || 13.0358,
          lng: orig.longitude || 77.5970,
          id: orig.id
        });
      }
    }
  }, [stations]);

  // Load Overpass POIs when toggled
  useEffect(() => {
    if (!showPOIs) {
      setPois([]);
      return;
    }
    setLoadingPOIs(true);
    const centerLat = currentLocation?.lat || 12.9716;
    const centerLng = currentLocation?.lng || 77.5946;

    getNearbyPOIs(centerLat, centerLng, 2800, poiCategory)
      .then((data) => {
        setPois(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Error fetching OSM POIs:', err);
        setPois([]);
      })
      .finally(() => {
        setLoadingPOIs(false);
      });
  }, [showPOIs, poiCategory, currentLocation]);

  // 1. Handle Map Click (Place Marker & Reverse Geocode)
  const handleMapClick = ({ lat, lng }) => {
    const pinNumber = customMarkers.length + 1;
    const newPin = {
      id: `PIN-${pinNumber}`,
      name: `Custom Map Pin #${pinNumber}`,
      lat,
      lng,
      latitude: lat,
      longitude: lng,
      isCustomPin: true
    };

    setCustomMarkers((prev) => [...prev, newPin]);
    setSelectedNode(newPin);

    // If no origin set, set as origin; else if no destination set, set as destination
    if (!routeOrigin) {
      setRouteOrigin({ name: newPin.name, lat, lng, id: newPin.id });
    } else if (!routeDestination) {
      setRouteDestination({ name: newPin.name, lat, lng, id: newPin.id });
    }
  };

  // 2. Handle Search Selection
  const handleSelectPlace = (place) => {
    const loc = {
      ...place,
      lat: place.latitude,
      lng: place.longitude,
      id: `SEARCH-${place.place_id || Date.now()}`
    };
    setSearchedLocation(loc);
    setSelectedNode(loc);
    setRouteOrigin({ name: place.name || 'Searched Location', lat: loc.lat, lng: loc.lng, id: loc.id });
  };

  // 3. Handle Current Location Found (GPS)
  const handleLocationFound = (loc) => {
    setCurrentLocation(loc);
    const locNode = {
      id: 'MY-LOCATION',
      name: 'My Current Location (GPS)',
      lat: loc.lat,
      lng: loc.lng,
      latitude: loc.lat,
      longitude: loc.lng,
      accuracy: loc.accuracy
    };
    setSelectedNode(locNode);
    setRouteOrigin({ name: 'My Current Location', lat: loc.lat, lng: loc.lng, id: 'MY-LOCATION' });
  };

  // 4. Handle Deleting Custom Marker
  const handleDeleteCustomMarker = (pinId) => {
    setCustomMarkers((prev) => prev.filter((p) => p.id !== pinId));
    if (selectedNode?.id === pinId) {
      setSelectedNode(null);
    }
    if (routeOrigin?.id === pinId) setRouteOrigin(null);
    if (routeDestination?.id === pinId) setRouteDestination(null);
  };

  // 5. Swap Origin & Destination
  const handleSwapPoints = () => {
    const temp = routeOrigin;
    setRouteOrigin(routeDestination);
    setRouteDestination(temp);
    setActiveRoute(null);
  };

  // 6. Set Preset Route
  const handleSelectPreset = (presetOrigin, presetDest) => {
    setRouteOrigin(presetOrigin);
    setRouteDestination(presetDest);
    setActiveRoute(null);
  };

  return (
    <div className="glass-panel p-4 sm:p-5 border border-[#202F49] space-y-4 font-sans shadow-2xl">
      {/* Top Header & Open Source Tech Badges */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#202F49] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#162238] border border-[#2563EB] text-[#38BDF8] flex items-center justify-center shrink-0 shadow-md">
            <Navigation className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider font-heading">
                OpenStreetMap Navigation & EV Corridor Map
              </h3>
              <span className="px-2 py-0.2 bg-[#0E201B] border border-emerald-600 text-emerald-400 font-mono text-[9px] font-bold uppercase tracking-wider">
                Leaflet • OpenStreetMap • OSRM
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              100% Free & Open-Source. OpenStreetMap tiles, Nominatim geocoding, and OSRM road routing.
            </p>
          </div>
        </div>

        {/* Current Location Trigger */}
        <CurrentLocation onLocationFound={handleLocationFound} />
      </div>

      {/* Nominatim Search Bar & POI Filter Row */}
      <div className="space-y-2">
        <MapSearch
          onSelectPlace={handleSelectPlace}
          onClearSearch={() => setSearchedLocation(null)}
        />

        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <POIFilterControl
            showPOIs={showPOIs}
            onToggleShowPOIs={setShowPOIs}
            selectedCategory={poiCategory}
            onSelectCategory={setPoiCategory}
            poiCount={pois.length}
            loading={loadingPOIs}
          />

          {/* Map Legend */}
          <div className="flex items-center gap-3 text-[11px] text-slate-300 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#1D4ED8] border border-white"></span>
              <span className="text-[#38BDF8]">EV Hub ({activeStations.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
              <span className="text-emerald-400">My Location</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-amber-500"></span>
              <span className="text-amber-400">Custom Pin</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-600"></span>
              <span className="text-rose-400">Ambulance</span>
            </div>
          </div>
        </div>
      </div>

      {/* The Leaflet Interactive Map View */}
      <MapView
        stations={activeStations}
        evs={evs}
        customMarkers={customMarkers}
        currentLocation={currentLocation}
        searchedLocation={searchedLocation}
        pois={pois}
        activeRoute={activeRoute}
        onMapClick={handleMapClick}
        onSelectNode={setSelectedNode}
        selectedNodeId={selectedNode?.id}
      />

      {/* Bottom Panel: Route Planning (OSRM) & Selected Place Details (Nominatim) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* OSRM Route Control */}
        <RouteControl
          origin={routeOrigin}
          destination={routeDestination}
          activeRoute={activeRoute}
          onRouteCalculated={setActiveRoute}
          onClearRoute={() => setActiveRoute(null)}
          onSwapPoints={handleSwapPoints}
          onSelectPreset={handleSelectPreset}
        />

        {/* Selected Place / Marker Details with Reverse Geocoding */}
        <PlaceDetails
          selectedNode={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSetOrigin={(node) => {
            const lat = node.lat ?? node.latitude;
            const lng = node.lng ?? node.longitude;
            setRouteOrigin({ name: node.name || node.id, lat, lng, id: node.id });
          }}
          onSetDestination={(node) => {
            const lat = node.lat ?? node.latitude;
            const lng = node.lng ?? node.longitude;
            setRouteDestination({ name: node.name || node.id, lat, lng, id: node.id });
          }}
          onDeleteCustomMarker={handleDeleteCustomMarker}
        />
      </div>
    </div>
  );
}
