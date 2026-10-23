'use client';

import React from 'react';
import {
  Award,
  Briefcase,
  Cpu,
  Info,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { StoryAnalytics } from '@/lib/story-stats';

interface StoryStatsDashboardProps {
  analytics: StoryAnalytics;
  topicColor?: string;
}

export function StoryStatsDashboard({ analytics, topicColor = 'blue' }: StoryStatsDashboardProps) {
  const { stats, bars, sections } = analytics;

  return (
    <div className="story-stats-dashboard">
      {/* ── 1. Key Statistics Cards Grid ── */}
      {stats.length > 0 && (
        <section aria-label="Key Specifications" className="story-metrics-grid">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className={`metric-card ${stat.highlight ? 'is-highlighted' : ''}`}
            >
              <span className="metric-label">{stat.label}</span>
              <div className="metric-value">{stat.value}</div>
              {stat.subtext && <span className="metric-subtext">{stat.subtext}</span>}
            </div>
          ))}
        </section>
      )}

      {/* ── 2. Empirical Benchmark Report (Displayed ONLY when real benchmark scores exist) ── */}
      {bars && bars.length > 0 && (
        <section aria-label="Empirical Benchmarks" className="story-benchmark-card">
          <div className="benchmark-header">
            <div className="benchmark-title-wrap">
              <Award size={18} className="text-violet-400" />
              <div>
                <span className="benchmark-title">Empirical Benchmark Performance</span>
                <span className="benchmark-subtitle">Verified scores extracted directly from model evaluation reports</span>
              </div>
            </div>
            <span className="benchmark-badge">Empirical Results</span>
          </div>

          <div className="benchmark-list">
            {bars.map((bar, idx) => (
              <div key={idx} className="benchmark-item">
                <div className="benchmark-labels">
                  <div className="benchmark-meta">
                    <span className="benchmark-name">{bar.label}</span>
                    {bar.category && <span className="benchmark-cat-pill">{bar.category}</span>}
                  </div>
                  <span className="benchmark-value-pill">{bar.displayValue}</span>
                </div>
                <div className="benchmark-track">
                  <div
                    className="benchmark-fill"
                    style={{
                      width: `${bar.value}%`,
                      backgroundColor: bar.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 3. Structured Story Breakdown Sections ── */}
      {sections.length > 0 && (
        <div className="story-sections-flow">
          {sections.map((section, idx) => {
            const Icon =
              section.iconName === 'cpu'
                ? Cpu
                : section.iconName === 'info'
                ? Info
                : section.iconName === 'zap'
                ? Zap
                : section.iconName === 'briefcase'
                ? Briefcase
                : section.iconName === 'sliders'
                ? SlidersHorizontal
                : section.iconName === 'trending'
                ? TrendingUp
                : Sparkles;

            return (
              <section key={idx} className="story-section-card">
                <div className="section-card-header">
                  <div className={`section-icon-badge badge-${topicColor}`}>
                    <Icon size={16} className={`section-icon icon-${topicColor}`} />
                  </div>
                  <h2>{section.title}</h2>
                </div>
                <div className="section-card-content">
                  {section.content.map((p, pIdx) => {
                    if (p.startsWith('### ') || p.startsWith('## ')) {
                      return (
                        <h3 key={pIdx} className="story-subheading">
                          {p.replace(/^#+\s*/, '')}
                        </h3>
                      );
                    }

                    const isCodeLike =
                      (p.startsWith('{') && p.endsWith('}')) ||
                      p.includes('responseFormat') ||
                      p.includes('s3Location') ||
                      p.includes('boto3.client') ||
                      p.startsWith('```');

                    if (isCodeLike) {
                      return (
                        <pre key={pIdx} className="story-code-block">
                          <code>{p.replace(/```[a-z]*\n?/g, '')}</code>
                        </pre>
                      );
                    }

                    const isList =
                      /^\s*[-*•]/.test(p) ||
                      /\n\s*[-*•]/.test(p);

                    if (isList) {
                      const bullets = p
                        .split(/\n+/)
                        .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
                        .filter(Boolean);
                      return (
                        <ul key={pIdx} className="story-bullet-list">
                          {bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                      );
                    }

                    return (
                      <p key={pIdx} className="story-paragraph">
                        {p}
                      </p>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

