import React from 'react';

/**
 * One metric tile. Fixed minimum height and identical label/value placement keeps
 * grids of tiles aligned regardless of whether the value is a number, a string or
 * "n/a", and whether or not a hint line is present.
 */
export default function StatTile({ label, value, unit, hint, tone = 'default', size = 'default' }) {
  const toneClass = {
    default: 'text-slate-900',
    primary: 'text-blue-700',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-rose-700',
    muted: 'text-slate-500',
  }[tone] || 'text-slate-900';

  const display = value === null || value === undefined || value === '' ? 'n/a' : value;

  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${size === 'sm' ? 'stat-value--sm' : ''} ${toneClass}`}>
        {display}
        {unit && display !== 'n/a' && <span className="stat-unit">{unit}</span>}
      </span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
