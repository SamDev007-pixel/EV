import React from 'react';

/**
 * Definition list laid out on a consistent two-column grid. Used for facts,
 * constraint verdicts, PEAS quadrants and other key/value detail blocks.
 */
export default function KeyValueGrid({ items = [], columns = 2 }) {
  const className = columns === 1 ? 'kv-grid grid-cols-1 sm:grid-cols-1' : 'kv-grid';

  return (
    <dl className={className}>
      {items.map(({ term, value, mono = false }, index) => (
        <div key={`${term}-${index}`} className="min-w-0">
          <dt className="kv-term">{term}</dt>
          <dd className={`kv-value ${mono ? 'font-mono text-xs' : ''}`}>{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
