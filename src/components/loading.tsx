import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Shared loading indicator.
 *
 * Used as the Suspense fallback wherever a route streams its content in, so
 * the reader sees motion and a clear message instead of a blank frame.
 */
export function LoadingSpinner({
  label = 'Loading',
  variant = 'panel',
}: {
  label?: string;
  /** `panel` is a centred card; `inline` sits inside an existing surface. */
  variant?: 'panel' | 'inline';
}) {
  return (
    <div
      className={`app-loading app-loading-${variant}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 size={18} className="app-loading-spinner" aria-hidden="true" />
      <span className="app-loading-label">{label}</span>
    </div>
  );
}

/**
 * A shimmering placeholder block, used where the shape of the content is
 * known (a list of story rows) and a spinner alone would feel abrupt.
 */
export function LoadingSkeleton({
  rows = 4,
  label = 'Loading',
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="app-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="app-skeleton-row" key={i}>
          <span className="app-skeleton-node" />
          <span className="app-skeleton-lines">
            <span className="app-skeleton-line" style={{ width: `${72 - i * 7}%` }} />
            <span className="app-skeleton-line app-skeleton-line-sm" style={{ width: `${44 - i * 5}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
