import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, MapPin, Building, GraduationCap, Plane, Navigation2 } from 'lucide-react';
import { searchPlaces } from '../../services/osmApi';

const QUICK_SEARCH_EXAMPLES = [
  { label: 'Rajalakshmi Engg College', query: 'Rajalakshmi Engineering College Chennai' },
  { label: 'Chennai Airport', query: 'Chennai International Airport' },
  { label: 'MG Road Bengaluru', query: 'MG Road Metro Station Bengaluru' },
  { label: 'Indiranagar Hub', query: 'Indiranagar Bengaluru' },
  { label: 'Electronic City', query: 'Electronic City Bengaluru' }
];

export default function MapSearch({ onSelectPlace, onClearSearch }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceTimerRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search to strictly follow Nominatim's 1-req/sec guidelines and avoid spamming
  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await searchPlaces(query, 5);
        setResults(data);
        setIsOpen(true);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  const handleSelect = (place) => {
    setQuery(place.name || place.display_name.split(',')[0]);
    setIsOpen(false);
    if (onSelectPlace) {
      onSelectPlace(place);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (onClearSearch) {
      onClearSearch();
    }
  };

  const handleQuickChip = (chipQuery) => {
    setQuery(chipQuery);
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-2 font-sans">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-slate-400 pointer-events-none">
          {loading ? (
            <Loader2 className="w-4 h-4 text-[#38BDF8] animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-[#38BDF8]" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search location, college, landmark (e.g. Rajalakshmi Engineering College, Chennai Airport)..."
          className="w-full pl-9 pr-24 py-2 bg-[#131B2B] border border-[#202F49] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#3B82F6] transition-all font-sans shadow-inner"
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-white hover:bg-[#1E2D4A] rounded transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => query && searchPlaces(query, 5).then(setResults)}
            className="px-2.5 py-1 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer border border-[#3B82F6]"
          >
            Search
          </button>
        </div>
      </div>

      {/* Quick Landmark Chips */}
      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
        <span className="text-slate-400 font-medium">Quick Suggestions:</span>
        {QUICK_SEARCH_EXAMPLES.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleQuickChip(chip.query)}
            className="px-2 py-0.5 bg-[#162238] hover:bg-[#1E2D4A] text-slate-300 hover:text-[#38BDF8] border border-[#202F49] hover:border-[#38BDF8]/40 transition-all cursor-pointer font-sans"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Autocomplete Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0F172A] border border-[#202F49] shadow-2xl z-[1200] max-h-72 overflow-y-auto divide-y divide-[#1E2D4A]">
          <div className="px-3 py-1.5 bg-[#162238] text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <span>OpenStreetMap / Nominatim Results ({results.length})</span>
            <span className="text-[#38BDF8]">Click to center map</span>
          </div>

          {results.map((item, idx) => (
            <div
              key={item.place_id || idx}
              onClick={() => handleSelect(item)}
              className="p-3 hover:bg-[#1E293B] cursor-pointer transition-colors flex items-start gap-2.5 text-xs group"
            >
              <div className="w-6 h-6 mt-0.5 bg-[#1E2D4A] text-[#38BDF8] flex items-center justify-center shrink-0 border border-[#2B3E60] group-hover:border-[#38BDF8]">
                {item.type === 'college' || item.type === 'university' ? (
                  <GraduationCap className="w-3.5 h-3.5" />
                ) : item.type === 'aerodrome' ? (
                  <Plane className="w-3.5 h-3.5" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-white font-semibold truncate group-hover:text-[#38BDF8]">
                    {item.name || item.display_name.split(',')[0]}
                  </strong>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 bg-[#131B2B] text-slate-400 border border-[#202F49] shrink-0">
                    {item.type || 'place'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                  {item.display_name}
                </p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-1">
                  <span>Lat: {item.latitude.toFixed(4)}°</span>
                  <span>Lng: {item.longitude.toFixed(4)}°</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
