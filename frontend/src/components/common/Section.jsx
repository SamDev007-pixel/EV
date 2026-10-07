import React from 'react';

/**
 * Card with a consistent header row (title, optional description, optional actions).
 * Used for every content block so section spacing and heading placement match
 * across the application.
 */
export default function Section({ title, description, icon: Icon, actions, children, className = '', bodyClassName = 'space-y-4' }) {
  const hasHead = Boolean(title || actions);

  return (
    <section className={`ai-card section ${className}`}>
      {hasHead && (
        <div className="section-head">
          <div className="min-w-0">
            {title && (
              <h2 className="section-title">
                {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
                <span className="truncate">{title}</span>
              </h2>
            )}
            {description && <p className="section-desc">{description}</p>}
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
