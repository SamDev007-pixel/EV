import React from 'react';
import { Layers, Zap, Car, Stethoscope, Bus, Coffee, Check, Loader2 } from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All POIs', icon: Layers },
  { id: 'charging_station', label: 'EV Hubs', icon: Zap },
  { id: 'parking', label: 'Parking', icon: Car },
  { id: 'hospital', label: 'Hospitals', icon: Stethoscope },
  { id: 'transit', label: 'Transit', icon: Bus },
  { id: 'restaurant', label: 'Dining', icon: Coffee }
];

export default function POIFilterControl({
  showPOIs,
  onToggleShowPOIs,
  selectedCategory,
  onSelectCategory,
  poiCount = 0,
  loading = false
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap font-sans text-xs">
      {/* Enable / Disable POIs Toggle Button */}
      <button
        type="button"
        onClick={() => onToggleShowPOIs(!showPOIs)}
        className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
          showPOIs
            ? 'bg-[#1D4ED8] text-white border-[#3B82F6]'
            : 'bg-[#131B2B] text-slate-300 hover:text-white hover:bg-[#1E2D4A] border-[#202F49]'
        }`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#38BDF8]" />
        ) : (
          <Layers className="w-3.5 h-3.5 text-[#38BDF8]" />
        )}
        <span>OSM POI Layer</span>
        {showPOIs && (
          <span className="ml-1 px-1.5 py-0.2 bg-black/40 text-[10px] font-mono rounded">
            {poiCount}
          </span>
        )}
      </button>

      {/* Category Filter Pills (Visible when POIs are turned on) */}
      {showPOIs && (
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium border transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#2563EB] text-white border-[#3B82F6] font-bold shadow-xs'
                    : 'bg-[#162238] text-slate-300 hover:text-white hover:bg-[#1E2D4A] border-[#202F49]'
                }`}
              >
                <Icon className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-[#38BDF8]'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
