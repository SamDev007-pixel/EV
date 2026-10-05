import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, RotateCcw, AlertCircle, Compass, Zap } from 'lucide-react';

// Tile layer presets (100% Free, OpenStreetMap-based, Zero Google Maps)
const TILE_PRESETS = {
  osm: {
    name: 'OpenStreetMap (Standard)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    }
  },
  carto_dark: {
    name: 'CartoDB Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c', 'd'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  },
  hot: {
    name: 'OSM Humanitarian',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    }
  }
};

export default function MapView({
  stations = [],
  evs = [],
  customMarkers = [],
  currentLocation = null,
  searchedLocation = null,
  pois = [],
  activeRoute = null,
  onMapClick,
  onSelectNode,
  selectedNodeId = null
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const currentTileLayerRef = useRef(null);

  // Layer groups for clean updates without re-initializing the map
  const stationsLayerRef = useRef(null);
  const evsLayerRef = useRef(null);
  const customMarkersLayerRef = useRef(null);
  const userLocLayerRef = useRef(null);
  const searchedLocLayerRef = useRef(null);
  const poisLayerRef = useRef(null);
  const routeLayerRef = useRef(null);

  // Prevent repeated unwanted fitBounds re-centering
  const hasInitialCenteredRef = useRef(false);

  // Keep latest callback references to prevent stale closures in Leaflet events
  const onMapClickRef = useRef(onMapClick);
  const onSelectNodeRef = useRef(onSelectNode);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onSelectNodeRef.current = onSelectNode;
  }, [onMapClick, onSelectNode]);

  // Default to standard OpenStreetMap tiles
  const [activeTileKey, setActiveTileKey] = useState('osm');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Default coordinate center (Bengaluru Metro EV Corridor)
  const DEFAULT_CENTER = [12.9716, 77.5946];

  // Helper to convert internal grid coords (x,y) to Bengaluru Lat/Lng
  const gridToLatLng = (x, y) => {
    const safeX = typeof x === 'number' ? x : 5.0;
    const safeY = typeof y === 'number' ? y : 5.0;
    const lat = DEFAULT_CENTER[0] + (safeY - 5.0) * 0.008;
    const lng = DEFAULT_CENTER[1] + (safeX - 5.0) * 0.008;
    return [lat, lng];
  };

  // 1. Initialize Leaflet Map (Run ONCE on Mount)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Safety cleanup of any lingering Leaflet instance or ID
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    if (mapContainerRef.current._leaflet_id) {
      delete mapContainerRef.current._leaflet_id;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 12,
        zoomControl: true,
        attributionControl: true
      });

      // Add default tile layer
      const preset = TILE_PRESETS[activeTileKey] || TILE_PRESETS.osm;
      const tileLayer = L.tileLayer(preset.url, preset.options).addTo(map);
      currentTileLayerRef.current = tileLayer;

      // Initialize layer groups
      stationsLayerRef.current = L.layerGroup().addTo(map);
      evsLayerRef.current = L.layerGroup().addTo(map);
      customMarkersLayerRef.current = L.layerGroup().addTo(map);
      userLocLayerRef.current = L.layerGroup().addTo(map);
      searchedLocLayerRef.current = L.layerGroup().addTo(map);
      poisLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);

      // Handle map clicks
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (onMapClickRef.current) {
          onMapClickRef.current({ lat, lng });
        }
      });

      mapInstanceRef.current = map;
      setMapReady(true);

      // Multiple invalidateSize calls to guarantee tile painting across all browser rendering stages
      const timers = [
        setTimeout(() => map && map.invalidateSize(), 50),
        setTimeout(() => map && map.invalidateSize(), 200),
        setTimeout(() => map && map.invalidateSize(), 600),
        setTimeout(() => map && map.invalidateSize(), 1200)
      ];

      const handleResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        timers.forEach(t => clearTimeout(t));
        window.removeEventListener('resize', handleResize);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    } catch (err) {
      console.error('Failed to initialize Leaflet Map:', err);
      setMapError('Failed to load Leaflet interactive map: ' + err.message);
    }
  }, []);

  // 2. Handle Tile Layer Switching
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    const preset = TILE_PRESETS[activeTileKey] || TILE_PRESETS.osm;
    if (currentTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(currentTileLayerRef.current);
    }
    const newLayer = L.tileLayer(preset.url, preset.options).addTo(mapInstanceRef.current);
    currentTileLayerRef.current = newLayer;
  }, [activeTileKey, mapReady]);

  // 3. Render Station Markers (Do NOT call fitBounds every render!)
  useEffect(() => {
    if (!mapReady || !stationsLayerRef.current) return;
    stationsLayerRef.current.clearLayers();

    const bengaluruBounds = [];

    stations.forEach((st) => {
      let lat = typeof st.latitude === 'number' ? st.latitude : null;
      let lng = typeof st.longitude === 'number' ? st.longitude : null;

      if (lat === null || lng === null) {
        const loc = st.location || {};
        const coords = gridToLatLng(loc.x, loc.y);
        lat = coords[0];
        lng = coords[1];
      }

      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        return;
      }

      // Collect Bengaluru regional bounds only (12.7 to 13.2 lat, 77.4 to 77.8 lng)
      if (lat >= 12.7 && lat <= 13.2 && lng >= 77.4 && lng <= 77.8) {
        bengaluruBounds.push([lat, lng]);
      }

      const status = st.operatingStatus || st.status || st.operating_status || 'OPERATIONAL';
      const isFault = status === 'FAULT';
      const isSelected = selectedNodeId === st.id;
      const rawName = st.name || st.id;
      const stationName = rawName.length > 24 ? rawName.substring(0, 22) + '...' : rawName;
      const powerKw = st.charging_power_kw || st.chargingPower || st.charging_power || 60;

      // High-visibility SVG pin with charging symbol
      const pinColor = isFault ? '#EF4444' : isSelected ? '#2563EB' : '#1D4ED8';
      const borderColor = isSelected ? '#FFFFFF' : '#0B101B';

      const iconHtml = `
        <div class="relative group cursor-pointer flex flex-col items-center">
          <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'}; transition: transform 0.15s ease;">
            <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 34 14 34C14 34 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${pinColor}" stroke="${borderColor}" stroke-width="2"/>
            <circle cx="14" cy="14" r="8" fill="#FFFFFF"/>
            <path d="M14.8 8.5L10.5 14.5H14L13.2 19.5L17.5 13.5H14L14.8 8.5Z" fill="${isFault ? '#EF4444' : '#1D4ED8'}"/>
          </svg>

          <!-- Label badge -->
          <div class="mt-0.5 px-1.5 py-0.2 bg-[#0B101B] border border-[#202F49] text-white text-[9px] font-mono whitespace-nowrap shadow-lg">
            ${st.id.replace('STATION-', '').replace('CS-', '')}
          </div>

          <!-- Tooltip on hover -->
          <div class="absolute bottom-10 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-0.5 px-2.5 py-1 bg-[#0B101B] text-white border border-[#202F49] text-[10px] font-mono whitespace-nowrap shadow-2xl z-50 pointer-events-none">
            <strong class="text-[#38BDF8]">${stationName}</strong>
            <span class="text-slate-300">Power: ${powerKw} kW • Status: ${status}</span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'custom-station-pin',
        iconSize: [28, 42],
        iconAnchor: [14, 34]
      });

      const marker = L.marker([lat, lng], { icon }).addTo(stationsLayerRef.current);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectNodeRef.current) {
          onSelectNodeRef.current({
            ...st,
            lat,
            lng,
            latitude: lat,
            longitude: lng
          });
        }
      });

      marker.bindPopup(`
        <div style="font-family: sans-serif; color: #fff; background: #0B101B; padding: 10px; border: 1px solid #202F49; font-size: 11px; min-width: 160px;">
          <strong style="color: #38BDF8; font-size: 12px; display: block; margin-bottom: 4px;">${st.name || st.id}</strong>
          <div style="color: #E2E8F0; margin-bottom: 2px;">⚡ Rated Power: <strong>${powerKw} kW</strong></div>
          <div style="color: #94A3B8; font-size: 10px;">Status: <span style="color: ${isFault ? '#F87171' : '#34D399'}">${status}</span></div>
          <div style="color: #94A3B8; font-size: 10px; margin-top: 4px;">(${lat.toFixed(4)}°, ${lng.toFixed(4)}°)</div>
        </div>
      `);
    });

    // Run fitBounds ONLY ONCE on initial mount so the user isn't forcibly zoomed out on every update
    if (!hasInitialCenteredRef.current && bengaluruBounds.length > 1 && mapInstanceRef.current) {
      try {
        mapInstanceRef.current.fitBounds(bengaluruBounds, { padding: [50, 50], maxZoom: 13 });
        hasInitialCenteredRef.current = true;
      } catch (err) {
        // ignore
      }
    }
  }, [stations, selectedNodeId, mapReady]);

  // 4. Render EV Fleet Markers
  useEffect(() => {
    if (!mapReady || !evsLayerRef.current) return;
    evsLayerRef.current.clearLayers();

    evs.forEach((ev, idx) => {
      let lat = typeof ev.latitude === 'number' ? ev.latitude : null;
      let lng = typeof ev.longitude === 'number' ? ev.longitude : null;

      if (lat === null || lng === null) {
        const curLoc = ev.current_location || {};
        const evX = curLoc.x ?? ev.current_location_x ?? (((idx + 1) * 2.2) % 10 + 1);
        const evY = curLoc.y ?? ev.current_location_y ?? (((idx + 1) * 2.8) % 10 + 1);
        const coords = gridToLatLng(evX, evY);
        lat = coords[0];
        lng = coords[1];
      }

      const priority = String(ev.priority || ev.urgency_level || '').toUpperCase();
      const isEmergency = priority.includes('EMERGENCY') || priority.includes('CRITICAL');
      const isCharging = ev.status === 'CHARGING';
      const isSelected = selectedNodeId === ev.id;

      let badgeBg = 'bg-[#131B2B] text-[#38BDF8] border-[#202F49]';
      let displayId = ev.id.replace('EV-', 'EV');

      if (isEmergency) {
        badgeBg = 'bg-rose-950 text-rose-200 border-rose-600 animate-pulse';
        displayId = '108-EMG';
      } else if (isCharging) {
        badgeBg = 'bg-[#1D4ED8] text-white border-[#3B82F6]';
      }

      if (isSelected) {
        badgeBg += ' ring-2 ring-white scale-110';
      }

      const evIconHtml = `
        <div class="px-2 py-0.5 border ${badgeBg} font-mono text-[9px] font-bold flex items-center justify-center shadow-xl whitespace-nowrap cursor-pointer hover:scale-110 transition-transform">
          🚗 ${displayId}
        </div>
      `;

      const evIcon = L.divIcon({
        html: evIconHtml,
        className: 'custom-ev-marker',
        iconSize: [52, 22],
        iconAnchor: [26, 11]
      });

      const evMarker = L.marker([lat, lng], { icon: evIcon }).addTo(evsLayerRef.current);
      evMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectNodeRef.current) {
          onSelectNodeRef.current({
            ...ev,
            lat,
            lng,
            latitude: lat,
            longitude: lng
          });
        }
      });
    });
  }, [evs, selectedNodeId, mapReady]);

  // 5. Render User Placed Custom Pin Markers
  useEffect(() => {
    if (!mapReady || !customMarkersLayerRef.current) return;
    customMarkersLayerRef.current.clearLayers();

    customMarkers.forEach((pin) => {
      const pinIconHtml = `
        <div class="relative cursor-pointer group flex flex-col items-center">
          <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));">
            <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 34 14 34C14 34 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#F59E0B" stroke="#FFFFFF" stroke-width="2"/>
            <circle cx="14" cy="14" r="6" fill="#0B101B"/>
          </svg>
          <div class="mt-0.5 px-1.5 py-0.2 bg-[#0B101B] border border-amber-500 text-amber-300 font-mono text-[9px] whitespace-nowrap">
            ${pin.name || 'Pinned Point'}
          </div>
        </div>
      `;

      const pinIcon = L.divIcon({
        html: pinIconHtml,
        className: 'custom-user-pin',
        iconSize: [28, 42],
        iconAnchor: [14, 34]
      });

      const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon }).addTo(customMarkersLayerRef.current);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectNodeRef.current) {
          onSelectNodeRef.current({
            ...pin,
            isCustomPin: true,
            latitude: pin.lat,
            longitude: pin.lng
          });
        }
      });
    });
  }, [customMarkers, mapReady]);

  // 6. Render User's Current Location Marker (GPS) - Smooth FlyTo
  useEffect(() => {
    if (!mapReady || !userLocLayerRef.current) return;
    userLocLayerRef.current.clearLayers();

    if (currentLocation && currentLocation.lat && currentLocation.lng) {
      const { lat, lng } = currentLocation;

      const userIconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-9 h-9 rounded-full bg-emerald-500/30 animate-ping"></div>
          <div class="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center">
            <span class="w-2 h-2 bg-white rounded-full"></span>
          </div>
        </div>
      `;

      const userIcon = L.divIcon({
        html: userIconHtml,
        className: 'custom-gps-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([lat, lng], { icon: userIcon }).addTo(userLocLayerRef.current);
      marker.bindPopup(`
        <div style="font-family: sans-serif; color: #fff; background: #0B101B; padding: 8px; border: 1px solid #10B981; font-size: 11px;">
          <strong style="color: #34D399; display: block; margin-bottom: 2px;">Your Current Location</strong>
          <span>(${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E)</span>
        </div>
      `);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lng], 14, { animate: true, duration: 1.0 });
      }
    }
  }, [currentLocation, mapReady]);

  // 7. Render Searched Location Marker - Smooth FlyTo
  useEffect(() => {
    if (!mapReady || !searchedLocLayerRef.current) return;
    searchedLocLayerRef.current.clearLayers();

    if (searchedLocation && searchedLocation.latitude && searchedLocation.longitude) {
      const { latitude: lat, longitude: lng, name, display_name } = searchedLocation;

      const searchIconHtml = `
        <div class="relative flex flex-col items-center">
          <svg width="32" height="38" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(37,99,235,0.7));">
            <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 34 14 34C14 34 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#3B82F6" stroke="#FFFFFF" stroke-width="2"/>
            <circle cx="14" cy="14" r="7" fill="#FFFFFF"/>
            <text x="14" y="18" font-size="10" text-anchor="middle" fill="#1D4ED8" font-weight="bold">📍</text>
          </svg>
          <div class="mt-0.5 px-2 py-0.5 bg-[#0B101B] border border-[#3B82F6] text-[#38BDF8] font-mono text-[9px] whitespace-nowrap shadow-lg">
            ${name || 'Searched Location'}
          </div>
        </div>
      `;

      const searchIcon = L.divIcon({
        html: searchIconHtml,
        className: 'custom-search-marker',
        iconSize: [32, 46],
        iconAnchor: [16, 38]
      });

      const marker = L.marker([lat, lng], { icon: searchIcon }).addTo(searchedLocLayerRef.current);
      marker.bindPopup(`
        <div style="font-family: sans-serif; color: #fff; background: #0B101B; padding: 8px; border: 1px solid #3B82F6; font-size: 11px; max-width: 220px;">
          <strong style="color: #38BDF8; display: block; margin-bottom: 2px;">${name || 'Searched Place'}</strong>
          <span style="color: #CBD5E1; font-size: 10px;">${display_name || ''}</span>
        </div>
      `).openPopup();

      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lng], 14, { animate: true, duration: 1.0 });
      }
    }
  }, [searchedLocation, mapReady]);

  // 8. Render OSM Overpass POIs
  useEffect(() => {
    if (!mapReady || !poisLayerRef.current) return;
    poisLayerRef.current.clearLayers();

    pois.forEach((poi) => {
      if (!poi.latitude || !poi.longitude) return;

      const category = poi.category || 'place';
      let iconEmoji = '📍';
      let badgeColor = 'bg-[#1E293B] text-slate-300 border-slate-700';

      if (category.includes('charging')) {
        iconEmoji = '⚡';
        badgeColor = 'bg-blue-950 text-blue-300 border-blue-700';
      } else if (category.includes('hospital')) {
        iconEmoji = '🏥';
        badgeColor = 'bg-rose-950 text-rose-300 border-rose-700';
      } else if (category.includes('parking')) {
        iconEmoji = '🅿️';
        badgeColor = 'bg-indigo-950 text-indigo-300 border-indigo-700';
      } else if (category.includes('bus') || category.includes('transit') || category.includes('subway')) {
        iconEmoji = '🚌';
        badgeColor = 'bg-amber-950 text-amber-300 border-amber-700';
      } else if (category.includes('restaurant') || category.includes('cafe')) {
        iconEmoji = '☕';
        badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-700';
      }

      const poiIconHtml = `
        <div class="w-6 h-6 rounded-full ${badgeColor} border text-[11px] flex items-center justify-center shadow-lg cursor-pointer hover:scale-125 transition-transform" title="${poi.name} (${category})">
          ${iconEmoji}
        </div>
      `;

      const poiIcon = L.divIcon({
        html: poiIconHtml,
        className: 'custom-poi-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([poi.latitude, poi.longitude], { icon: poiIcon }).addTo(poisLayerRef.current);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectNodeRef.current) {
          onSelectNodeRef.current({
            ...poi,
            lat: poi.latitude,
            lng: poi.longitude,
            id: poi.id || `POI-${category}`
          });
        }
      });
    });
  }, [pois, mapReady]);

  // 9. Render OSRM Road Route Polyline
  useEffect(() => {
    if (!mapReady || !routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();

    if (activeRoute && activeRoute.coordinates && activeRoute.coordinates.length > 0) {
      // Glow underlay polyline
      L.polyline(activeRoute.coordinates, {
        color: '#1D4ED8',
        weight: 8,
        opacity: 0.5,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayerRef.current);

      // Core crisp polyline
      const polyline = L.polyline(activeRoute.coordinates, {
        color: '#38BDF8',
        weight: 4,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayerRef.current);

      polyline.bindTooltip(
        `<strong>OSRM Driving Route</strong>: ${activeRoute.distance_km} km (${activeRoute.duration_min} min)`,
        { sticky: true, className: 'leaflet-route-tooltip' }
      );

      // Auto fit route bounds
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        } catch (e) {
          // ignore
        }
      }
    }
  }, [activeRoute, mapReady]);

  // Reset map view to center
  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(DEFAULT_CENTER, 12, { animate: true });
    }
  };

  return (
    <div className="relative w-full border border-[#202F49] overflow-hidden shadow-2xl bg-[#0B101B]">
      {/* Tile Switcher Controls Overlay */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-[#0B101B]/90 backdrop-blur-md border border-[#202F49] p-1 shadow-xl">
        {Object.keys(TILE_PRESETS).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTileKey(key)}
            className={`px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
              activeTileKey === key
                ? 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white border border-[#3B82F6] shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#1E2D4A] border border-transparent'
            }`}
          >
            {TILE_PRESETS[key].name}
          </button>
        ))}

        <button
          type="button"
          onClick={handleResetView}
          title="Reset map view to Bengaluru Center"
          className="p-1 text-slate-300 hover:text-white hover:bg-[#1E2D4A] border border-transparent hover:border-[#202F49] ml-1 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Map Hint / Status Notice */}
      <div className="absolute bottom-2 left-3 z-[1000] hidden sm:flex items-center gap-2 px-2.5 py-1 bg-[#0B101B]/90 backdrop-blur-md border border-[#202F49] text-[10px] text-slate-300 font-mono pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Leaflet + OpenStreetMap Active • Click any station or map location</span>
      </div>

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#0B101B]/95 text-rose-300 text-xs text-center">
          <AlertCircle className="w-5 h-5 text-rose-400 mr-2" />
          <span>{mapError}</span>
        </div>
      )}

      {/* Explicit Inline-Height Leaflet Container */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '520px',
          minHeight: '520px',
          position: 'relative',
          zIndex: 10
        }}
      />
    </div>
  );
}
