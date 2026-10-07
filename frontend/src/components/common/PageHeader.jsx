import React from 'react';

/**
 * Standard page header used by every screen.
 *
 * Keeping this in one place is what makes the pages line up: the eyebrow, title,
 * description and action row occupy the same grid position and spacing on every
 * screen instead of each view rolling its own banner.
 *
 * @param {string}   title       Page title (required).
 * @param {string}   description One or two sentences explaining what the page shows.
 * @param {string}   eyebrow     Small uppercase label above the title.
 * @param {node}     meta        Badges or chips rendered next to the eyebrow.
 * @param {node}     actions     Buttons/controls rendered on the right.
 */
export default function PageHeader({ title, description, eyebrow, meta, actions }) {
  return (
    <header className="page-head">
      <div className="page-head__text">
        {(eyebrow || meta) && (
          <div className="page-eyebrow">
            {eyebrow && <span>{eyebrow}</span>}
            {meta}
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>

      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
