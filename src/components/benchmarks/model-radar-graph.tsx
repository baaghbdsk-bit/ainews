'use client';

import React, { useState, useMemo } from 'react';
import type { AIModelRecord } from '@/lib/benchmarks/types';

interface ModelRadarGraphProps {
  selectedModels: AIModelRecord[];
}

interface RadarDimension {
  key: string;
  label: string;
  sub: string;
  sourceDesc: string;
}

const RADAR_DIMENSIONS: RadarDimension[] = [
  { key: 'reasoning', label: 'Reasoning', sub: 'GPQA / ARC', sourceDesc: 'GPQA Diamond, ARC-AGI-2, HLE' },
  { key: 'coding', label: 'Coding', sub: 'SWE Pro / AA', sourceDesc: 'SWE-bench Pro, AA Coding' },
  { key: 'agentic', label: 'Agentic', sub: 'Terminal 4.0', sourceDesc: 'Terminal-Bench 4.0 & AA Agentic' },
  { key: 'math', label: 'Mathematics', sub: 'FrontierMath', sourceDesc: 'FrontierMath v2 (Tiers 1-3)' },
  { key: 'preference', label: 'Preference', sub: 'Design ELO', sourceDesc: 'Design Arena human preference' },
  { key: 'general', label: 'General', sub: 'AA Index', sourceDesc: 'Artificial Analysis Intelligence Index' },
];

const COLOR_MAP: Record<string, { stroke: string; fill: string; dot: string; glow: string }> = {
  violet: {
    stroke: '#a855f7',
    fill: 'rgba(168, 85, 247, 0.22)',
    dot: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.45)',
  },
  blue: {
    stroke: '#3b82f6',
    fill: 'rgba(59, 130, 246, 0.22)',
    dot: '#60a5fa',
    glow: 'rgba(59, 130, 246, 0.45)',
  },
  cyan: {
    stroke: '#06b6d4',
    fill: 'rgba(6, 182, 212, 0.22)',
    dot: '#22d3ee',
    glow: 'rgba(6, 182, 212, 0.45)',
  },
  amber: {
    stroke: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.22)',
    dot: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.45)',
  },
  emerald: {
    stroke: '#10b981',
    fill: 'rgba(16, 185, 129, 0.22)',
    dot: '#34d399',
    glow: 'rgba(16, 185, 129, 0.45)',
  },
  rose: {
    stroke: '#f43f5e',
    fill: 'rgba(244, 63, 94, 0.22)',
    dot: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.45)',
  },
};

function getModelDimensionScore(model: AIModelRecord, dimKey: string): { score: number; rawText: string; hasData: boolean } {
  const b = model.benchmarks;
  switch (dimKey) {
    case 'reasoning': {
      const gpqa = b['gpqa-diamond']?.score;
      const arc = b['arc-agi']?.score;
      const hle = b['hle']?.score;
      const aaInt = b['aa-intelligence']?.score;
      if (typeof gpqa === 'number') return { score: Math.round(gpqa), rawText: `GPQA: ${gpqa}%`, hasData: true };
      if (typeof arc === 'number') return { score: Math.round(arc), rawText: `ARC-AGI-2: ${arc}%`, hasData: true };
      if (typeof hle === 'number') return { score: Math.round(hle), rawText: `HLE: ${hle}%`, hasData: true };
      if (typeof aaInt === 'number') return { score: Math.round(aaInt), rawText: `AA Index: ${aaInt}%`, hasData: true };
      return { score: 0, rawText: 'Not reported', hasData: false };
    }
    case 'coding': {
      const pro = b['swe-bench-pro']?.score;
      const aaCode = b['aa-coding']?.score;
      if (typeof pro === 'number') return { score: Math.round(pro), rawText: `SWE-bench Pro: ${pro}%`, hasData: true };
      if (typeof aaCode === 'number') return { score: Math.round(aaCode), rawText: `AA Coding: ${aaCode}%`, hasData: true };
      return { score: 0, rawText: 'Not reported', hasData: false };
    }
    case 'agentic': {
      const terminal = b['terminal-bench']?.score;
      const agenticIndex = b['aa-agentic']?.score;
      if (typeof terminal === 'number') return { score: Math.round(terminal), rawText: `Terminal 4.0: ${terminal}%`, hasData: true };
      if (typeof agenticIndex === 'number') return { score: Math.round(agenticIndex), rawText: `AA Agentic: ${agenticIndex}%`, hasData: true };
      return { score: 0, rawText: 'Not reported', hasData: false };
    }
    case 'math': {
      const frontier = b['frontiermath']?.score;
      if (typeof frontier === 'number') return { score: Math.round(frontier), rawText: `FrontierMath: ${frontier}%`, hasData: true };
      const aaInt = b['aa-intelligence']?.score;
      if (typeof aaInt === 'number') return { score: Math.round(aaInt), rawText: `AA Index: ${aaInt}%`, hasData: true };
      return { score: 0, rawText: 'Not reported', hasData: false };
    }
    case 'preference': {
      const arena = b['design-arena']?.score;
      if (typeof arena === 'number') {
        const normalized = Math.min(100, Math.max(10, Math.round(((arena - 1000) / 450) * 100)));
        return { score: normalized, rawText: `${Math.round(arena)} ELO`, hasData: true };
      }
      return { score: 0, rawText: 'Not reported', hasData: false };
    }
    case 'general': {
      const aaInt = b['aa-intelligence']?.score;
      if (typeof aaInt === 'number') return { score: Math.round(aaInt), rawText: `AA Index: ${aaInt}%`, hasData: true };
      return { score: 0, rawText: 'Not reported', hasData: false };
    }
    default:
      return { score: 0, rawText: 'Not reported', hasData: false };
  }
}

export function ModelRadarGraph({ selectedModels }: ModelRadarGraphProps) {
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [hiddenModelIds, setHiddenModelIds] = useState<Set<string>>(new Set());

  const toggleModelVisibility = (id: string) => {
    setHiddenModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const center = 160;
  const radius = 115;
  const numAxes = RADAR_DIMENSIONS.length;
  const angleStep = (Math.PI * 2) / numAxes;

  // Calculate polygon points for each grid level
  const gridPolygons = useMemo(() => {
    const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
    return gridLevels.map((lvl) => {
      const pts = RADAR_DIMENSIONS.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = center + radius * lvl * Math.cos(angle);
        const y = center + radius * lvl * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return pts;
    });
  }, [radius, angleStep, center]);

  // Model polygon paths
  const modelPolygons = useMemo(() => {
    return selectedModels.map((model) => {
      const points = RADAR_DIMENSIONS.map((dim, i) => {
        const { score, hasData } = getModelDimensionScore(model, dim.key);
        const ratio = hasData ? Math.max(0.12, Math.min(1.0, score / 100)) : 0.04;
        const angle = i * angleStep - Math.PI / 2;
        const x = center + radius * ratio * Math.cos(angle);
        const y = center + radius * ratio * Math.sin(angle);
        return { x, y, score, hasData, dimKey: dim.key };
      });
      const pathStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      return { model, points, pathStr };
    });
  }, [selectedModels, radius, angleStep, center]);

  return (
    <div className="radar-graph-card" aria-label="Model Capability Radar Comparison">
      <div className="radar-graph-header">
        <div className="radar-header-info">
          <div className="radar-tag">Multi-Axis Synthesis</div>
          <h3 className="radar-title">Relative Capability Radar</h3>
          <p className="radar-subtitle">
            Normalized 6-dimension evaluation comparing reasoning, software engineering, agentic terminal use, mathematical research, human design preference, and the Artificial Analysis Intelligence Index.
          </p>
        </div>

        {/* Legend pills with interactive visibility toggle */}
        <div className="radar-legend-bar" role="toolbar" aria-label="Toggle models on radar">
          {selectedModels.map((m) => {
            const isHidden = hiddenModelIds.has(m.id);
            const isHovered = activeModelId === m.id;
            const colors = COLOR_MAP[m.developerColor] || COLOR_MAP.violet;

            return (
              <button
                type="button"
                key={m.id}
                onClick={() => toggleModelVisibility(m.id)}
                onMouseEnter={() => setActiveModelId(m.id)}
                onMouseLeave={() => setActiveModelId(null)}
                className={`radar-legend-pill ${isHidden ? 'is-muted' : ''} ${
                  isHovered ? 'is-highlighted' : ''
                }`}
                title={`Click to ${isHidden ? 'show' : 'hide'} ${m.name} on radar`}
              >
                <span
                  className="radar-legend-dot"
                  style={{
                    backgroundColor: isHidden ? '#64748b' : colors.stroke,
                    boxShadow: isHidden ? 'none' : `0 0 8px ${colors.glow}`,
                  }}
                />
                <span className="radar-legend-name">{m.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="radar-visual-layout">
        {/* SVG Canvas */}
        <div className="radar-svg-container">
          <svg
            viewBox="0 0 320 320"
            className="radar-svg"
            role="img"
            aria-label="Radar chart showing model attributes"
          >
            <defs>
              <radialGradient id="radarGridGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(139, 92, 246, 0.08)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>

            {/* Background grid glow */}
            <circle cx={center} cy={center} r={radius} fill="url(#radarGridGlow)" />

            {/* Concentric grid polygons */}
            {gridPolygons.map((pts, idx) => (
              <polygon
                key={idx}
                points={pts}
                className="radar-grid-line"
                fill="none"
                stroke="var(--bench-line)"
                strokeDasharray={idx === gridPolygons.length - 1 ? 'none' : '3,3'}
                strokeWidth={idx === gridPolygons.length - 1 ? '1.2' : '0.8'}
              />
            ))}

            {/* Percentage watermark ticks */}
            <text x={center + 4} y={center - radius * 0.4} className="radar-tick-label">40%</text>
            <text x={center + 4} y={center - radius * 0.8} className="radar-tick-label">80%</text>
            <text x={center + 4} y={center - radius + 11} className="radar-tick-label">100%</text>

            {/* Axis spokes */}
            {RADAR_DIMENSIONS.map((_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const x2 = center + radius * Math.cos(angle);
              const y2 = center + radius * Math.sin(angle);
              return (
                <line
                  key={i}
                  x1={center}
                  y1={center}
                  x2={x2}
                  y2={y2}
                  className="radar-spoke-line"
                  stroke="var(--bench-line)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Model Polygons */}
            {modelPolygons.map(({ model, pathStr, points }) => {
              if (hiddenModelIds.has(model.id)) return null;
              const colors = COLOR_MAP[model.developerColor] || COLOR_MAP.violet;
              const isHovered = activeModelId === model.id;
              const isAnyHovered = activeModelId !== null;
              const opacity = isAnyHovered ? (isHovered ? 1 : 0.22) : 0.85;

              return (
                <g key={model.id} className="radar-model-group" opacity={opacity}>
                  <polygon
                    points={pathStr}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={isHovered ? 2.5 : 1.6}
                    strokeLinejoin="round"
                    style={{
                      filter: isHovered ? `drop-shadow(0 0 6px ${colors.glow})` : 'none',
                      transition: 'opacity 180ms ease, stroke-width 180ms ease',
                    }}
                  />
                  {/* Point dots */}
                  {points.map((pt, pIdx) => (
                    <circle
                      key={pIdx}
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.hasData ? (isHovered ? 4 : 2.5) : (isHovered ? 2 : 1.2)}
                      fill={pt.hasData ? colors.dot : 'var(--bench-line)'}
                      stroke="var(--bench-panel)"
                      strokeWidth="1"
                      opacity={pt.hasData ? 1 : 0.4}
                    />
                  ))}
                </g>
              );
            })}

            {/* Axis Labels (Positioned at spoke ends) */}
            {RADAR_DIMENSIONS.map((dim, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const labelRadius = radius + 22;
              const lx = center + labelRadius * Math.cos(angle);
              const ly = center + labelRadius * Math.sin(angle);

              let textAnchor: 'middle' | 'start' | 'end' = 'middle';
              if (Math.cos(angle) > 0.3) textAnchor = 'start';
              else if (Math.cos(angle) < -0.3) textAnchor = 'end';

              return (
                <g key={dim.key} transform={`translate(${lx}, ${ly})`}>
                  <text
                    x={0}
                    y={0}
                    textAnchor={textAnchor}
                    className="radar-axis-label-main"
                  >
                    {dim.label}
                  </text>
                  <text
                    x={0}
                    y={11}
                    textAnchor={textAnchor}
                    className="radar-axis-label-sub"
                  >
                    {dim.sub}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Side Dimension Breakdown Grid */}
        <div className="radar-stats-side-panel">
          <div className="radar-panel-head">
            <span className="radar-panel-title">Dimension Breakdown</span>
            <span className="radar-panel-models-count">
              {selectedModels.length - hiddenModelIds.size} active
            </span>
          </div>

          <div className="radar-dimensions-list">
            {RADAR_DIMENSIONS.map((dim) => {
              // Find leader for this dimension strictly among models with actual reported data
              const scores = selectedModels
                .filter((m) => !hiddenModelIds.has(m.id))
                .map((m) => ({
                  model: m,
                  ...getModelDimensionScore(m, dim.key),
                }))
                .filter((entry) => entry.hasData)
                .sort((a, b) => b.score - a.score);

              const leader = scores[0];

              return (
                <div key={dim.key} className="radar-dim-row">
                  <div className="radar-dim-info">
                    <span className="radar-dim-name">{dim.label}</span>
                    <span className="radar-dim-source">{dim.sourceDesc}</span>
                  </div>

                  <div className="radar-dim-leader">
                    {leader ? (
                      <div className="radar-leader-chip">
                        <span
                          className={`model-color-dot fill-${leader.model.developerColor}`}
                          aria-hidden="true"
                        />
                        <span className="radar-leader-model">{leader.model.name}</span>
                        <span className="radar-leader-val">{leader.rawText}</span>
                      </div>
                    ) : (
                      <span className="radar-none-text">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
