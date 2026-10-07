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
  carto_light: {
    name: 'CARTO light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
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

      const status = st.operating_status || 'OPERATIONAL';
      const isFault = status === 'FAULT';
      const isSelected = selectedNodeId === st.id;
      const rawName = st.name || st.id;
      const powerKw = st.charging_power ?? null;

      // Modern, sleek SVG pin with clean electric bolt and precise anchor
      const pinColor = isFault ? '#D13212' : isSelected ? '#0972D3' : '#0073BB';
      const isFastDc = powerKw && powerKw >= 60;

      const iconHtml = `
        <div class="relative cursor-pointer flex flex-col items-center group">
          ${isSelected ? '<div class="absolute -top-1 w-8 h-8 rounded-full bg-blue-500/25 animate-ping"></div>' : ''}
          <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.28)); transform: ${isSelected ? 'scale(1.18)' : 'scale(1)'}; transition: transform 0.15s ease;">
            <path d="M12 0C5.373 0 0 5.373 0 12C0 19.8 10.2 28.8 11.25 29.72C11.68 30.09 12.32 30.09 12.75 29.72C13.8 28.8 24 19.8 24 12C24 5.373 18.627 0 12 0Z" fill="${pinColor}" stroke="#FFFFFF" stroke-width="1.8"/>
            <circle cx="12" cy="11.5" r="7.5" fill="#FFFFFF"/>
            ${isFault ? `
              <path d="M12 7.5V12M12 14.5V15" stroke="#D13212" stroke-width="2" stroke-linecap="round"/>
            ` : `
              <path d="M12.6 6.5L8.5 12H11.8L11.2 16.5L15.5 11H12L12.6 6.5Z" fill="${pinColor}"/>
            `}
          </svg>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'custom-station-pin',
        iconSize: [24, 30],
        iconAnchor: [12, 30]
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

      // Minimalist hover tooltip instead of cluttered permanent map badges
      marker.bindTooltip(`
        <div style="font-family: 'Amazon Ember', -apple-system, sans-serif; font-size: 11px; line-height: 1.35;">
          <strong style="color: #0F172A; display: block;">${rawName}</strong>
          <span style="color: #64748B; font-size: 10px;">
            ${powerKw !== null ? `${Number(powerKw).toFixed(0)} kW` : 'Standard'} &middot; <span style="color: ${isFault ? '#DC2626' : '#047857'}; font-weight: 600;">${status}</span>
          </span>
        </div>
      `, {
        direction: 'top',
        offset: [0, -32],
        className: 'leaflet-clean-tooltip',
        opacity: 1
      });

      marker.bindPopup(`
        <div style="font-family: 'Amazon Ember', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; background: #FFFFFF; padding: 10px; border: 1px solid #E2E8F0; font-size: 11px; min-width: 170px; border-radius: 6px;">
          <strong style="color: #1D4ED8; font-size: 12px; display: block; margin-bottom: 4px;">${st.name || st.id}</strong>
          <div style="color: #334155; margin-bottom: 2px;">Rated power: <strong>${powerKw !== null ? `${Number(powerKw).toFixed(0)} kW` : 'not reported'}</strong></div>
          <div style="color: #64748B; font-size: 10px;">Status: <span style="color: ${isFault ? '#DC2626' : '#047857'}">${status}</span></div>
          <div style="color: #64748B; font-size: 10px; margin-top: 4px;">(${lat.toFixed(4)}°, ${lng.toFixed(4)}°)</div>
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
      const displayId = ev.id.replace('EV-', 'EV');
      const soc = ev.soc !== undefined ? Math.round(ev.soc <= 1 ? ev.soc * 100 : ev.soc) : null;

      let circleBg = '#1E293B'; // Dark Slate for regular EV
      let glyphSvg = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2 10.9 2 11.2 2 11.5V16c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <path d="M9 17h6"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
      `;
      let statusLabel = ev.status || 'Active';

      if (isEmergency) {
        circleBg = '#D13212'; // Crimson Red
        glyphSvg = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z"/>
          </svg>
        `;
        statusLabel = 'Emergency Priority';
      } else if (isCharging) {
        circleBg = '#0972D3'; // AWS Blue
        glyphSvg = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M13 2L4 14h7l-2 8 11-12h-7l2-8z"/>
          </svg>
        `;
        statusLabel = 'Charging';
      }

      const evIconHtml = `
        <div class="relative cursor-pointer flex items-center justify-center">
          ${isSelected ? '<div class="absolute -inset-1 rounded-full bg-blue-400/40 animate-ping"></div>' : ''}
          ${isEmergency ? '<div class="absolute -inset-1.5 rounded-full bg-rose-500/35 animate-ping"></div>' : ''}
          <div style="background-color: ${circleBg}; width: 24px; height: 24px; border-radius: 9999px; border: 2px solid #FFFFFF; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'}; transition: transform 0.15s ease;">
            ${glyphSvg}
          </div>
        </div>
      `;

      const evIcon = L.divIcon({
        html: evIconHtml,
        className: 'custom-ev-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
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

      evMarker.bindTooltip(`
        <div style="font-family: 'Amazon Ember', -apple-system, sans-serif; font-size: 11px; line-height: 1.35;">
          <strong style="color: #0F172A; display: block;">${displayId} ${isEmergency ? '<span style="color: #DC2626; font-size: 9px; font-weight: 700;">[EMERGENCY]</span>' : ''}</strong>
          <span style="color: #64748B; font-size: 10px;">
            ${statusLabel}${soc !== null ? ` &middot; SoC ${soc}%` : ''}
          </span>
        </div>
      `, {
        direction: 'top',
        offset: [0, -12],
        className: 'leaflet-clean-tooltip',
        opacity: 1
      });
    });
  }, [evs, selectedNodeId, mapReady]);

  // 5. Render User Placed Custom Pin Markers
  useEffect(() => {
    if (!mapReady || !customMarkersLayerRef.current) return;
    customMarkersLayerRef.current.clearLayers();

    customMarkers.forEach((pin) => {
      const pinIconHtml = `
        <div class="relative cursor-pointer flex flex-col items-center">
          <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.28));">
            <path d="M12 0C5.373 0 0 5.373 0 12C0 19.8 10.2 28.8 11.25 29.72C11.68 30.09 12.32 30.09 12.75 29.72C13.8 28.8 24 19.8 24 12C24 5.373 18.627 0 12 0Z" fill="#D97706" stroke="#FFFFFF" stroke-width="1.8"/>
            <circle cx="12" cy="11.5" r="7.5" fill="#FFFFFF"/>
            <circle cx="12" cy="11.5" r="3.5" fill="#D97706"/>
          </svg>
        </div>
      `;

      const pinIcon = L.divIcon({
        html: pinIconHtml,
        className: 'custom-user-pin',
        iconSize: [24, 30],
        iconAnchor: [12, 30]
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

      marker.bindTooltip(`
        <div style="font-family: 'Amazon Ember', -apple-system, sans-serif; font-size: 11px;">
          <strong style="color: #92400E;">${pin.name || 'Pinned Point'}</strong>
        </div>
      `, {
        direction: 'top',
        offset: [0, -32],
        className: 'leaflet-clean-tooltip',
        opacity: 1
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
        <div style="font-family: 'Amazon Ember', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; background: #FFFFFF; padding: 8px; border: 1px solid #A7F3D0; font-size: 11px; border-radius: 6px;">
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
          <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.28));">
            <path d="M12 0C5.373 0 0 5.373 0 12C0 19.8 10.2 28.8 11.25 29.72C11.68 30.09 12.32 30.09 12.75 29.72C13.8 28.8 24 19.8 24 12C24 5.373 18.627 0 12 0Z" fill="#0972D3" stroke="#FFFFFF" stroke-width="1.8"/>
            <circle cx="12" cy="11.5" r="7.5" fill="#FFFFFF"/>
            <circle cx="12" cy="11.5" r="3.5" fill="#0972D3"/>
          </svg>
        </div>
      `;

      const searchIcon = L.divIcon({
        html: searchIconHtml,
        className: 'custom-search-marker',
        iconSize: [24, 30],
        iconAnchor: [12, 30]
      });

      const marker = L.marker([lat, lng], { icon: searchIcon }).addTo(searchedLocLayerRef.current);
      marker.bindPopup(`
        <div style="font-family: 'Amazon Ember', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; background: #FFFFFF; padding: 8px; border: 1px solid #BFDBFE; font-size: 11px; max-width: 220px; border-radius: 6px;">
          <strong style="color: #1D4ED8; display: block; margin-bottom: 2px;">${name || 'Searched Place'}</strong>
          <span style="color: #475569; font-size: 10px;">${display_name || ''}</span>
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
      let badgeColor = 'bg-white text-slate-600 border-slate-300';

      if (category.includes('charging')) {
        iconEmoji = '⚡';
        badgeColor = 'bg-blue-50 text-blue-700 border-blue-300';
      } else if (category.includes('hospital')) {
        iconEmoji = '🏥';
        badgeColor = 'bg-rose-50 text-rose-700 border-rose-300';
      } else if (category.includes('parking')) {
        iconEmoji = '🅿️';
        badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-300';
      } else if (category.includes('bus') || category.includes('transit') || category.includes('subway')) {
        iconEmoji = '🚌';
        badgeColor = 'bg-amber-50 text-amber-700 border-amber-300';
      } else if (category.includes('restaurant') || category.includes('cafe')) {
        iconEmoji = '☕';
        badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-300';
      }

      const poiIconHtml = `
        <div class="w-6 h-6 rounded-full ${badgeColor} border text-2xs flex items-center justify-center shadow-sm cursor-pointer hover:scale-125 transition-transform" title="${poi.name} (${category})">
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

      marker.bindTooltip(`
        <div style="font-family: 'Amazon Ember', -apple-system, sans-serif; font-size: 11px;">
          <strong style="color: #0F172A;">${poi.name}</strong>
          <span style="color: #64748B; font-size: 10px; display: block;">${category}</span>
        </div>
      `, {
        direction: 'top',
        offset: [0, -12],
        className: 'leaflet-clean-tooltip',
        opacity: 1
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
        color: '#93C5FD',
        weight: 8,
        opacity: 0.6,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayerRef.current);

      // Core crisp polyline
      const polyline = L.polyline(activeRoute.coordinates, {
        color: '#2563EB',
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
    <div className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      {/* Tile Switcher Controls Overlay */}
      <div className="absolute right-3 top-3 z-[1000] flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 p-1 shadow-sm">
        {Object.keys(TILE_PRESETS).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTileKey(key)}
            className={`px-2.5 py-1 text-2xs font-semibold transition-all cursor-pointer ${
              activeTileKey === key
                ? 'bg-blue-600 text-white border border-blue-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
            }`}
          >
            {TILE_PRESETS[key].name}
          </button>
        ))}

        <button
          type="button"
          onClick={handleResetView}
          title="Reset map view to the default centre"
          className="btn-ghost btn-sm ml-0.5 px-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Map Hint / Status Notice */}
      <div className="pointer-events-none absolute bottom-2 left-3 z-[1000] hidden items-center gap-2 rounded-md border border-slate-200 bg-white/95 px-2.5 py-1 font-mono text-2xs text-slate-600 sm:flex">
        <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
        <span>OpenStreetMap &middot; click a station or anywhere on the map</span>
      </div>

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center gap-2 bg-white/95 p-4 text-center text-xs text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
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
