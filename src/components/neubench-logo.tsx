'use client';

import '@/styles/neubench-logo.css';

type NeubenchLogoVariant = 'wordmark' | 'full' | 'icon';

interface NeubenchLogoProps {
  variant?: NeubenchLogoVariant;
  size?: number;
  className?: string;
  ariaLabel?: string;
  'aria-label'?: string;
}

const BARS = (
  <>
    <rect className="neubench-logo-bar neubench-logo-bar--blue" x="0" y="0" width="65" height="16" rx="8" fill="#4777FF" />
    <rect className="neubench-logo-bar neubench-logo-bar--violet" x="0" y="28" width="65" height="16" rx="8" fill="#8055F5" />
    <rect className="neubench-logo-bar neubench-logo-bar--teal" x="0" y="56" width="65" height="16" rx="8" fill="#13DCCB" />
  </>
);

export function NeubenchLogo({
  variant = 'wordmark',
  size = 22,
  className = '',
  ariaLabel,
  'aria-label': ariaLabelProp,
}: NeubenchLogoProps) {
  const label = ariaLabel ?? ariaLabelProp ?? 'NEUBENCH';

  if (variant === 'icon') {
    return (
      <span
        role="img"
        aria-label={label}
        className={`neubench-logo-icon ${className}`.trim()}
        style={{ width: size, height: size }}
      >
        <span className="neubench-logo-e" aria-hidden="true">
          <svg viewBox="0 0 65 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            {BARS}
          </svg>
        </span>
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      className={`neubench-logo-wordmark ${className}`.trim()}
      style={{ fontSize: size }}
    >
      <span className="neubench-logo-letters" aria-hidden="true">
        N
      </span>
      <span className="neubench-logo-e" aria-hidden="true">
        <svg viewBox="0 0 65 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          {BARS}
        </svg>
      </span>
      <span className="neubench-logo-letters" aria-hidden="true">
        UBENCH
      </span>
    </span>
  );
}

export const NeuBenchLogo = NeubenchLogo;
export const NeuralPulseLogo = NeubenchLogo;
export default NeubenchLogo;
