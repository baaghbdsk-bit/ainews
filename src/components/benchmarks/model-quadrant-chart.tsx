'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AIModelRecord } from '@/lib/benchmarks/types';

interface ModelQuadrantChartProps {
  selectedModels: AIModelRecord[];
  allModels: AIModelRecord[];
}

const COLOR_MAP: Record<string, string> = {
  violet: '#a855f7',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  amber: '#f59e0b',
  emerald: '#10b981',
  rose: '#f43f5e',
};

export function ModelQuadrantChart({ selectedModels, allModels }: ModelQuadrantChartProps) {
  const [hoveredModel, setHoveredModel] = useState<AIModelRecord | null>(null);
  const [showAllBackground, setShowAllBackground] = useState<boolean>(true);

  // SVG dimensions
  const width = 680;
  const height = 360;
  const padLeft = 60;
  const padRight = 40;
  const padTop = 30;
  const padBottom = 45;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  // Domain scales
  // X: Artificial Analysis Intelligence Index (0 to 70 empirical index; dataset models range 4.8 to 57.6)
  const minScore = 0;
  const maxScore = 70;
  const scoreToX = (score: number) => {
    const clamped = Math.max(minScore, Math.min(maxScore, score));
    return padLeft + ((clamped - minScore) / (maxScore - minScore)) * chartWidth;
  };

  // Y: Output Cost ($0 to $35) — using square root scale for distinguishing budget vs premium
  const maxPrice = 35;
  const priceToY = (price: number) => {
    const clamped = Math.max(0, Math.min(maxPrice, price));
    // Sqrt scale makes $0.30 - $5.00 distinguishable from $15 - $30
    const ratio = Math.sqrt(clamped) / Math.sqrt(maxPrice);
    return padTop + chartHeight - ratio * chartHeight;
  };

  // Midlines for quadrants: 30 intelligence index represents the frontier baseline; $7.50/1M separates budget from premium
  const midX = scoreToX(30);
  const midY = priceToY(7.5);

  const selectedSet = new Set(selectedModels.map((m) => m.id));

  // Ticks
  const scoreTicks = [10, 20, 30, 40, 50, 60, 70];
  const priceTicks = [0, 1, 5, 10, 20, 30];

  // Partition selected models into plottable vs unplottable
  const plottableSelected: { model: AIModelRecord; capability: number; cost: number }[] = [];
  const unplottableSelected: { model: AIModelRecord; reason: string }[] = [];

  selectedModels.forEach((m) => {
    const capability = m.benchmarks['aa-intelligence']?.score;
    const hasCapability = typeof capability === 'number' && Number.isFinite(capability);
    const hasNumericCost = typeof m.pricing.outputPerMillion === 'number' && Number.isFinite(m.pricing.outputPerMillion);
    const isOpenWeights = m.specs.isOpenWeights || m.pricing.outputPerMillion === 'Free (Open Weights)';

    if (!hasCapability && !hasNumericCost && !isOpenWeights) {
      unplottableSelected.push({
        model: m,
        reason: 'Missing both Intelligence Index and verified pricing',
      });
    } else if (!hasCapability) {
      unplottableSelected.push({
        model: m,
        reason: 'No published Artificial Analysis Intelligence Index',
      });
    } else if (!hasNumericCost && !isOpenWeights) {
      unplottableSelected.push({
        model: m,
        reason: 'Pricing unverified or unlisted (contact vendor)',
      });
    } else {
      plottableSelected.push({
        model: m,
        capability,
        cost: hasNumericCost ? (m.pricing.outputPerMillion as number) : 0,
      });
    }
  });

  return (
    <div className="quadrant-chart-card" aria-label="Capability vs Pricing Matrix">
      <div className="quadrant-header">
        <div className="quadrant-header-copy">
          <div className="radar-tag">Capability Economics</div>
          <h3 className="radar-title">Capability vs. API Output Cost</h3>
          <p className="radar-subtitle">
            Quadrant positioning of the Artificial Analysis Intelligence Index against output cost ($/1M tokens). Models without verified capability or pricing metrics are excluded from plot coordinates to prevent artificial distortion.
          </p>
        </div>

        <div className="quadrant-controls">
          <label className="quadrant-toggle-label">
            <input
              type="checkbox"
              checked={showAllBackground}
              onChange={(e) => setShowAllBackground(e.target.checked)}
              className="quadrant-checkbox"
            />
            <span>Show background models context</span>
          </label>
        </div>
      </div>

      <div className="quadrant-svg-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="quadrant-svg"
          role="img"
          aria-label="Scatter plot showing capability vs cost"
        >
          {/* Quadrant Background Zones */}
          <rect
            x={padLeft}
            y={padTop}
            width={midX - padLeft}
            height={midY - padTop}
            className="quadrant-zone zone-reasoning"
          />
          <rect
            x={midX}
            y={padTop}
            width={padLeft + chartWidth - midX}
            height={midY - padTop}
            className="quadrant-zone zone-premium"
          />
          <rect
            x={padLeft}
            y={midY}
            width={midX - padLeft}
            height={padTop + chartHeight - midY}
            className="quadrant-zone zone-open"
          />
          <rect
            x={midX}
            y={midY}
            width={padLeft + chartWidth - midX}
            height={padTop + chartHeight - midY}
            className="quadrant-zone zone-efficient"
          />

          {/* Quadrant Zone Labels */}
          <text x={padLeft + 12} y={padTop + 20} className="quadrant-label-text">
            Deep Reasoning / Premium
          </text>
          <text x={padLeft + chartWidth - 12} y={padTop + 20} textAnchor="end" className="quadrant-label-text">
            High Capability / Premium
          </text>
          <text x={padLeft + 12} y={padTop + chartHeight - 14} className="quadrant-label-text">
            Open Weights / Self-Hosted ($0)
          </text>
          <text
            x={padLeft + chartWidth - 12}
            y={padTop + chartHeight - 14}
            textAnchor="end"
            className="quadrant-label-text text-emerald-400"
          >
            ⚡ Sweet Spot (High Capability, Low Cost)
          </text>

          {/* Quadrant Axis Dividers */}
          <line
            x1={midX}
            y1={padTop}
            x2={midX}
            y2={padTop + chartHeight}
            stroke="var(--bench-line)"
            strokeDasharray="4,4"
            strokeWidth="1"
          />
          <line
            x1={padLeft}
            y1={midY}
            x2={padLeft + chartWidth}
            y2={midY}
            stroke="var(--bench-line)"
            strokeDasharray="4,4"
            strokeWidth="1"
          />

          {/* Y Axis Grid Lines & Ticks */}
          {priceTicks.map((p) => {
            const y = priceToY(p);
            return (
              <g key={p}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + chartWidth}
                  y2={y}
                  stroke="var(--bench-line)"
                  strokeWidth="0.6"
                  opacity="0.4"
                />
                <text x={padLeft - 8} y={y + 3.5} textAnchor="end" className="quadrant-axis-tick">
                  {p === 0 ? '$0' : `$${p}`}
                </text>
              </g>
            );
          })}

          {/* X Axis Grid Lines & Ticks */}
          {scoreTicks.map((t) => {
            const x = scoreToX(t);
            return (
              <g key={t}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + chartHeight}
                  stroke="var(--bench-line)"
                  strokeWidth="0.6"
                  opacity="0.4"
                />
                <text x={x} y={padTop + chartHeight + 16} textAnchor="middle" className="quadrant-axis-tick">
                  {t}
                </text>
              </g>
            );
          })}

          {/* Axis Titles */}
          <text
            x={padLeft + chartWidth / 2}
            y={height - 8}
            textAnchor="middle"
            className="quadrant-axis-title"
          >
            Artificial Analysis Intelligence Index (→ More capable)
          </text>

          <text
            transform={`rotate(-90) translate(-${padTop + chartHeight / 2}, 16)`}
            textAnchor="middle"
            className="quadrant-axis-title"
          >
            Output Cost ($ / 1M Tokens)
          </text>

          {/* Background Models (Inactive Context) */}
          {showAllBackground &&
            allModels.map((m) => {
              if (selectedSet.has(m.id)) return null;
              const capability = m.benchmarks['aa-intelligence']?.score;
              if (typeof capability !== 'number' || !Number.isFinite(capability)) return null;
              const hasNumericCost = typeof m.pricing.outputPerMillion === 'number' && Number.isFinite(m.pricing.outputPerMillion);
              const isOpenWeights = m.specs.isOpenWeights || m.pricing.outputPerMillion === 'Free (Open Weights)';
              if (!hasNumericCost && !isOpenWeights) return null;
              const cost = hasNumericCost ? (m.pricing.outputPerMillion as number) : 0;
              const cx = scoreToX(capability);
              const cy = priceToY(cost);

              return (
                <circle
                  key={m.id}
                  cx={cx}
                  cy={cy}
                  r="2.5"
                  fill="#64748b"
                  opacity="0.4"
                  className="quadrant-bg-dot"
                  onMouseEnter={() => setHoveredModel(m)}
                  onMouseLeave={() => setHoveredModel(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`${m.name} (${cost > 0 ? `$${cost.toFixed(2)}` : 'Free'}/1M, AA index ${capability})`}</title>
                </circle>
              );
            })}

          {/* Active Compared Models */}
          {plottableSelected.map(({ model: m, capability, cost }, idx) => {
            const cx = scoreToX(capability);
            const cy = priceToY(cost);
            const color = COLOR_MAP[m.developerColor] || '#a855f7';
            const isHovered = hoveredModel?.id === m.id;
            const labelYOffset = idx % 2 === 0 ? -8 : 12;

            return (
              <g
                key={m.id}
                className="quadrant-active-point"
                onMouseEnter={() => setHoveredModel(m)}
                onMouseLeave={() => setHoveredModel(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer Glow Halo */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 12 : 7}
                  fill={color}
                  opacity={isHovered ? 0.35 : 0.18}
                  style={{ transition: 'r 160ms ease, opacity 160ms ease' }}
                />
                {/* Core Dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5.5 : 4}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />
                {/* Label */}
                <text
                  x={cx + (cx > width - 120 ? -8 : 8)}
                  y={cy + labelYOffset}
                  textAnchor={cx > width - 120 ? 'end' : 'start'}
                  className={`quadrant-point-label ${isHovered ? 'is-active' : ''}`}
                  fill={isHovered ? '#ffffff' : color}
                >
                  {m.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Floating Details Card */}
        {hoveredModel && (() => {
          const capability = hoveredModel.benchmarks['aa-intelligence']?.score;
          const hasNumericCost = typeof hoveredModel.pricing.outputPerMillion === 'number' && Number.isFinite(hoveredModel.pricing.outputPerMillion);
          const isOpenWeights = hoveredModel.specs.isOpenWeights || hoveredModel.pricing.outputPerMillion === 'Free (Open Weights)';
          const costDisplay = hasNumericCost
            ? `$${(hoveredModel.pricing.outputPerMillion as number).toFixed(2)}/1M${(hoveredModel.pricing.outputPerMillion as number) > maxPrice ? ' (clamped)' : ''}`
            : isOpenWeights
            ? 'Free (Open Weights)'
            : 'Pricing unverified';

          return (
            <div className="quadrant-hover-card" role="tooltip">
              <div className="quadrant-hover-title-row">
                <span
                  className={`model-color-dot fill-${hoveredModel.developerColor}`}
                  aria-hidden="true"
                />
                <span className="quadrant-hover-name">{hoveredModel.name}</span>
                <span className="quadrant-hover-dev">{hoveredModel.developer}</span>
              </div>

              <div className="quadrant-hover-stats">
                <div className="hover-stat-item">
                  <span className="hover-stat-label">Capability</span>
                  <span className="hover-stat-val text-violet-400">
                    {typeof capability === 'number'
                      ? `${capability} / 100`
                      : 'Not reported'}
                  </span>
                </div>
                <div className="hover-stat-item">
                  <span className="hover-stat-label">Output Cost</span>
                  <span className="hover-stat-val text-emerald-400">
                    {costDisplay}
                  </span>
                </div>
                <div className="hover-stat-item">
                  <span className="hover-stat-label">Context</span>
                  <span className="hover-stat-val">{hoveredModel.specs.displayContext}</span>
                </div>
                <div className="hover-stat-item">
                  <span className="hover-stat-label">License</span>
                  <span className="hover-stat-val">{hoveredModel.specs.isOpenWeights ? 'Open Weights' : 'API'}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Unplottable Models Notice (Transparency) */}
      {unplottableSelected.length > 0 && (
        <div className="quadrant-unplottable-notice" role="status">
          <div className="unplottable-notice-header">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>
              {unplottableSelected.length} compared model{unplottableSelected.length > 1 ? 's' : ''} cannot be plotted on this matrix:
            </span>
          </div>
          <div className="unplottable-model-list">
            {unplottableSelected.map(({ model, reason }) => (
              <div key={model.id} className="unplottable-model-item">
                <span className="unplottable-model-name">{model.name}</span>
                <span className="unplottable-model-dev">({model.developer})</span>
                <span className="unplottable-model-reason">— {reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Source Provenance Footer */}
      <div className="quadrant-provenance-footer">
        <div className="provenance-item">
          <strong>Capability Axis (X):</strong> Artificial Analysis Intelligence Index (0–70 empirical scale; 30+ baseline indicates frontier reasoning; source:{' '}
          <a
            href="https://artificialanalysis.ai/leaderboards/models"
            target="_blank"
            rel="noopener noreferrer"
          >
            Artificial Analysis Leaderboard
          </a>
          )
        </div>
        <div className="provenance-item">
          <strong>Cost Axis (Y):</strong> Hosted API pricing per 1M output tokens (verified via OpenRouter API &amp; vendor rate cards; open-weight weights map to $0/1M self-hosted software cost)
        </div>
      </div>
    </div>
  );
}
