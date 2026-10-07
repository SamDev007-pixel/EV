import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

const ICONS = {
  error: AlertCircle,
  warn: AlertTriangle,
  info: Info,
  ok: CheckCircle2,
};

/** Inline message banner with consistent padding and icon alignment. */
export default function Banner({ variant = 'info', children, action, className = '' }) {
  const Icon = ICONS[variant] || Info;
  return (
    <div className={`banner banner--${variant} ${className}`}>
      <Icon className="w-4 h-4 shrink-0 mt-px" />
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
