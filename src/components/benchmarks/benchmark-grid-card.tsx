'use client';

import React, { useState } from 'react';
import { ExternalLink, HelpCircle, AlertCircle, Trophy, TrendingUp } from 'lucide-react';
import type { AIModelRecord, BenchmarkDefinition } from '@/lib/benchmarks/types';

interface BenchmarkGridCardProps {
  benchmark: BenchmarkDefinition;
  selectedModels: AIModelRecord[];
}

export function BenchmarkGridCard({ benchmark, selectedModels }: BenchmarkGridCardProps) {
  const [isExplaining, setIsExplaining] = useState(false);
  const isElo = benchmark.unit === 'ELO';

  // Sort compared models by score descending (unreported sink to bottom)
  const rankedModels = [...selectedModels]
    .map((model, index) => ({ model, index }))
    .sort((a, b) => {
      const aScore = a.model.benchmarks[benchmark.id]?.score;
      const bScore = b.model.benchmarks[benchmark.id]?.score;
      if (aScore === undefined && bScore === undefined) return a.index - b.index;
      if (aScore === undefined) return 1;
      if (bScore === undefined) return -1;
      return bScore - aScore;
    })
    .map((entry) => entry.model);

  const reportedModels = rankedModels.filter((m) => m.benchmarks[benchmark.id]);
  const leaderModel = reportedModels[0];
  const runnerUpModel = reportedModels[1];

  let leaderDeltaText = '';
  let isTie = false;
  if (leaderModel && runnerUpModel) {
    const leaderScore = leaderModel.benchmarks[benchmark.id].score;
    const runnerScore = runnerUpModel.benchmarks[benchmark.id].score;
    const diff = leaderScore - runnerScore;
    if (diff > 0) {
      leaderDeltaText = `+${isElo ? Math.round(diff) + ' ELO' : diff.toFixed(1) + '%'} over ${runnerUpModel.name}`;
    } else if (diff === 0) {
      isTie = true;
      leaderDeltaText = `Tied for 1st with ${runnerUpModel.name}`;
    }
  } else if (leaderModel && reportedModels.length === 1 && selectedModels.length > 1) {
    leaderDeltaText = 'Sole evaluated model in selection';
  }

  const catSlug = benchmark.category.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`bench-grid-card cat-${catSlug}`} aria-label={`Benchmark: ${benchmark.name}`}>
      {/* Card Header */}
      <div className="bench-card-head">
        <div className="bench-card-title-group">
          <div className="bench-card-meta-line">
            <span className={`bench-domain-badge cat-${catSlug}`}>
              <span className="domain-badge-dot" aria-hidden="true" />
              {benchmark.category}
            </span>
            <span className="bench-card-unit">{isElo ? 'ELO Rating' : '% Benchmark Score'}</span>
          </div>
          <h4 className="bench-card-title">{benchmark.name}</h4>
        </div>

        <button
          type="button"
          onClick={() => setIsExplaining(!isExplaining)}
          className={`bench-card-info-btn ${isExplaining ? 'is-active' : ''}`}
          title="What does this benchmark evaluate?"
          aria-label={`About ${benchmark.name}`}
          aria-expanded={isExplaining}
        >
          <HelpCircle size={13} />
          <span>Explain</span>
        </button>
      </div>

      {/* Collapsible Info Drawer */}
      {isExplaining && (
        <div className="bench-card-explanation" role="region" aria-label="Benchmark details">
          <div className="bench-explanation-row">
            <span className="bench-explanation-label">Measures</span>
            <p className="bench-explanation-text">{benchmark.whatItMeasures}</p>
          </div>
          <div className="bench-explanation-row">
            <span className="bench-explanation-label">Significance</span>
            <p className="bench-explanation-text">{benchmark.realWorldSignificance}</p>
          </div>
          <div className="bench-card-caveat">
            <AlertCircle size={12} className="flex-shrink-0" />
            <span>
              <strong>Caveat:</strong> {benchmark.limitations}
            </span>
          </div>
        </div>
      )}

      {/* Leader Callout Banner */}
      {leaderModel && (leaderDeltaText || isTie) && (
        <div className="bench-card-leader-strip">
          <div className="leader-strip-left">
            <div className="leader-trophy-wrap">
              <Trophy size={12} className="leader-trophy-icon" />
            </div>
            <span className="leader-tag">{isTie ? 'Co-Leader' : 'Leader'}</span>
            <span className="leader-name">{leaderModel.name}</span>
            <span className="leader-score">
              {leaderModel.benchmarks[benchmark.id].displayValue}
            </span>
          </div>
          {leaderDeltaText && (
            <div className="leader-delta-badge">
              <TrendingUp size={10} className="leader-delta-icon" />
              <span>{leaderDeltaText}</span>
            </div>
          )}
        </div>
      )}

      {/* Comparative Bars Grid Rows */}
      <div className="bench-card-bars-stack">
        {rankedModels.map((model, idx) => {
          const scoreObj = model.benchmarks[benchmark.id];
          const hasScore = Boolean(scoreObj);
          const scoreVal = scoreObj?.score ?? 0;

          // Normalized width: ELO (1000-1500 dynamic span) vs Percentage (0-100)
          const fillPercent = isElo
            ? Math.min(100, Math.max(12, Math.round(((scoreVal - 1000) / 500) * 100)))
            : scoreVal;

          const isLeader = hasScore && idx === 0 && reportedModels.length > 0;
          const isOfficial = scoreObj?.evaluationType === 'Official Report';

          return (
            <div
              key={model.id}
              className={`bench-bar-item ${isLeader ? 'is-first-rank' : ''}`}
            >
              {/* Rank & Identity */}
              <div className="bench-bar-identity">
                <span className={`bench-bar-rank ${isLeader ? 'is-rank-first' : ''}`}>
                  {idx + 1}
                </span>
                <span
                  className={`model-color-dot fill-${model.developerColor}`}
                  aria-hidden="true"
                />
                <span className="bench-bar-model-name" title={model.name}>
                  {model.name}
                </span>
              </div>

              {/* Progress Track */}
              <div className="bench-bar-track-col">
                {hasScore ? (
                  <div className="bench-bar-track" aria-hidden="true">
                    <div
                      className={`bench-bar-fill fill-${model.developerColor}`}
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                ) : (
                  <div className="bench-bar-unreported">
                    <span>Not reported</span>
                  </div>
                )}
              </div>

              {/* Score Value & Provenance Link */}
              <div className="bench-bar-score-col">
                {hasScore ? (
                  <div className="bench-score-wrap">
                    <span className="bench-score-num">{scoreObj.displayValue}</span>
                    <a
                      href={scoreObj.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`bench-source-link ${
                        isOfficial ? 'is-official' : 'is-independent'
                      }`}
                      title={`Verified via ${scoreObj.evaluator} (${scoreObj.evaluationDate})`}
                    >
                      <span>{isOfficial ? 'Official' : 'Indep.'}</span>
                      <ExternalLink size={9} />
                    </a>
                  </div>
                ) : (
                  <span className="bench-score-na">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
