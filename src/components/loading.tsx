'use client';

import React from 'react';
import '@/styles/loading.css';

export interface NeubenchSpinnerProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  label?: string;
}

/**
 * Universal NeuBench 3-Color Circular Spinner.
 * 
 * Features a circular continuous spin displaying the 3 brand colors:
 * - Electric Blue (#4777FF)
 * - Solar Yellow (#FDE047)
 * - Mint / Emerald Teal (#13DCCB)
 * 
 * Scales seamlessly from 14px (buttons) to 64px (full-page loading).
 */
export function NeubenchSpinner({
  size = 24,
  className = '',
  strokeWidth = 4.5,
  label,
}: NeubenchSpinnerProps) {
  return (
    <span
      className={`neubench-spinner-wrap ${className}`.trim()}
      role="status"
      aria-label={label || 'Loading'}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg
        className="neubench-spinner-svg"
        width={size}
        height={size}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
        aria-hidden="true"
      >
        {/* Subtle background track */}
        <circle
          className="neubench-spinner-track"
          cx="22"
          cy="22"
          r="16"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          opacity="0.12"
          fill="none"
        />
        {/* Arc 1: Electric Blue */}
        <circle
          cx="22"
          cy="22"
          r="16"
          stroke="#4777FF"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="25 75.53"
          strokeDashoffset="0"
          fill="none"
        />
        {/* Arc 2: Solar Yellow */}
        <circle
          cx="22"
          cy="22"
          r="16"
          stroke="#FDE047"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="25 75.53"
          strokeDashoffset="-33.51"
          fill="none"
        />
        {/* Arc 3: Mint / Emerald Teal */}
        <circle
          cx="22"
          cy="22"
          r="16"
          stroke="#13DCCB"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="25 75.53"
          strokeDashoffset="-67.02"
          fill="none"
        />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

export interface NeubenchLoadingLogoProps {
  size?: number;
  label?: string;
  variant?: 'fullscreen' | 'panel' | 'inline';
  className?: string;
}

export function NeubenchLoadingLogo({
  size = 48,
  label = 'Loading…',
  variant = 'panel',
  className = '',
}: NeubenchLoadingLogoProps) {
  return (
    <div
      className={`neubench-loading-container neubench-loading-${variant} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <NeubenchSpinner size={size} strokeWidth={4.5} />
      {label && <p className="neubench-loading-label">{label}</p>}
    </div>
  );
}

export function LoadingSpinner({
  label = 'Loading…',
  variant = 'panel',
  size = 32,
}: {
  label?: string;
  variant?: 'panel' | 'inline';
  size?: number;
}) {
  if (variant === 'inline') {
    return (
      <span className="neubench-inline-loader" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <NeubenchSpinner size={size} strokeWidth={4.5} />
        {label && <span className="neubench-inline-loader-text">{label}</span>}
      </span>
    );
  }
  return <NeubenchLoadingLogo size={size} label={label} variant={variant} />;
}

export default NeubenchSpinner;
