import React from 'react';

/**
 * Shared loading indicator.
 *
 * Uses the NeuBench "E" logo with a continuous spin animation instead of a
 * generic spinner, so loading states feel branded.
 *
 * Used as the Suspense fallback wherever a route streams its content in, so
 * the reader sees motion and a clear message instead of a blank frame.
 */
export function LoadingSpinner({
  label = 'Loading',
  variant = 'panel',
  size = 22,
}: {
  label?: string;
  /** `panel` is a centred card; `inline` sits inside an existing surface. */
  variant?: 'panel' | 'inline';
  /** Width/height of the "E" logo in px. */
  size?: number;
}) {
  return (
    <div
      className={`app-loading app-loading-${variant}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="neubench-spinner"
        aria-hidden="true"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 65 72"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <rect
            className="neubench-spinner-bar neubench-spinner-bar--blue"
            x="0"
            y="0"
            width="65"
            height="16"
            rx="8"
            fill="#4777FF"
          />
          <rect
            className="neubench-spinner-bar neubench-spinner-bar--violet"
            x="0"
            y="28"
            width="65"
            height="16"
            rx="8"
            fill="#8055F5"
          />
          <rect
            className="neubench-spinner-bar neubench-spinner-bar--teal"
            x="0"
            y="56"
            width="65"
            height="16"
            rx="8"
            fill="#13DCCB"
          />
        </svg>
      </span>
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
