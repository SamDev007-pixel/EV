import React from 'react';
import { Loader2, Inbox, AlertCircle, Info } from 'lucide-react';

const VARIANTS = {
  loading: { icon: Loader2, spin: true, title: 'Loading', tone: 'text-blue-600' },
  empty: { icon: Inbox, spin: false, title: 'Nothing to show yet', tone: 'text-slate-400' },
  error: { icon: AlertCircle, spin: false, title: 'Something went wrong', tone: 'text-rose-600' },
  info: { icon: Info, spin: false, title: 'No data', tone: 'text-slate-400' },
};

/**
 * Uniform placeholder block for the four states every data view needs:
 * loading, empty, error and informational. Rendered inside whatever container the
 * caller supplies so it inherits the correct card/table alignment.
 */
export default function StateBlock({ variant = 'info', title, detail, action }) {
  const config = VARIANTS[variant] || VARIANTS.info;
  const Icon = config.icon;

  return (
    <div className="state">
      <Icon className={`w-5 h-5 ${config.tone} ${config.spin ? 'animate-spin' : ''}`} />
      <span className="state__title">{title || config.title}</span>
      {detail && <span className="state__detail">{detail}</span>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
