'use client';

import React, { useId } from 'react';

interface NeuBenchLogoProps {
  size?: number;
  className?: string;
}

/**
 * NeuBench official brand emblem — The Neural Benchmark Nexus ("N")
 * Precision isometric geometry uniting neural nodes, telemetry calibration,
 * and a radiant synaptic pulse vector.
 */
export function NeuBenchLogo({ size = 22, className = '' }: NeuBenchLogoProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="NeuBench Logo"
    >
      <defs>
        <linearGradient
          id={`neu-grad-p-${id}`}
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="45%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>

        <linearGradient
          id={`neu-grad-beam-${id}`}
          x1="6"
          y1="8"
          x2="26"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="48%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>

        <linearGradient
          id={`neu-grad-subtle-${id}`}
          x1="5"
          y1="5"
          x2="27"
          y2="27"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
        </linearGradient>

        <filter id={`neu-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#8b5cf6" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Outer Precision Hex Calibration Ring (Benchmark Precision) */}
      <path
        d="M16 2.5 L27 8.5 L27 23.5 L16 29.5 L5 23.5 L5 8.5 Z"
        stroke={`url(#neu-grad-subtle-${id})`}
        strokeWidth="1.2"
        fill="none"
      />

      {/* Left Benchmark Pillar */}
      <path
        d="M9 8 L9 24"
        stroke={`url(#neu-grad-p-${id})`}
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Synaptic Neural Pulse Beam (Diagonal of the "N") */}
      <path
        d="M9 8.5 L23 23.5"
        stroke={`url(#neu-grad-beam-${id})`}
        strokeWidth="3.2"
        strokeLinecap="round"
        filter={`url(#neu-glow-${id})`}
      />

      {/* Right Benchmark Pillar */}
      <path
        d="M23 8 L23 24"
        stroke={`url(#neu-grad-p-${id})`}
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Active Neural Pulse Nodes */}
      <circle cx="9" cy="8.5" r="2" fill="#22d3ee" />
      <circle cx="23" cy="23.5" r="2" fill="#ec4899" />
      <circle cx="16" cy="16" r="2.2" fill="#ffffff" filter={`url(#neu-glow-${id})`} />

      {/* Calibration Radar Tick Marks */}
      <line x1="16" y1="2.5" x2="16" y2="5" stroke="#22d3ee" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="16" y1="27" x2="16" y2="29.5" stroke="#a855f7" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="5" y1="16" x2="7.5" y2="16" stroke="#22d3ee" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="24.5" y1="16" x2="27" y2="16" stroke="#a855f7" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export const NeuralPulseLogo = NeuBenchLogo;
