'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Sparkles,
  TrendingUp,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Share2,
  ExternalLink,
  RefreshCw,
  Flame,
  ArrowRight,
  Cpu,
  Layers,
  FlaskConical,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  List,
  Bot,
  Mail,
  Braces,
  Building2,
  Wrench,
} from 'lucide-react';
import type { StoryDisplay } from '@/lib/timeline-shared';
import { useAuth } from '@/lib/auth/store';
import { showGuestNotice } from '@/components/auth/guest-notice';
import { selectDigestHighlights } from '@/lib/digest-priority';

export interface DailyDigestData {
  totalStories: number;
  dominantTopic: string;
  topicCounts: Record<string, number>;
  topicStories: Record<string, StoryDisplay[]>;
  companiesLead: string[];
  themes: { title: string; desc: string; count: number; tag: string }[];
  todayHighlights: StoryDisplay[];
}

export function computeDailyDigest(stories: StoryDisplay[]): DailyDigestData | null {
  if (!stories || stories.length === 0) {
    return null;
  }

  const recent = stories.slice(0, 30);
  const topicCounts: Record<string, number> = { Models: 0, Products: 0, Business: 0, Research: 0, Policy: 0, 'Dev Tools & Infra': 0 };
  const topicStories: Record<string, StoryDisplay[]> = { Models: [], Products: [], Business: [], Research: [], Policy: [], 'Dev Tools & Infra': [] };
  const companySet = new Set<string>();

  for (const story of recent) {
    if (topicCounts[story.topic] !== undefined) {
      topicCounts[story.topic] = (topicCounts[story.topic] || 0) + 1;
      topicStories[story.topic].push(story);
    }
    if (story.company) {
      companySet.add(story.company);
    }
  }

  let topTopic = 'Models';
  let maxCount = -1;
  for (const [topic, count] of Object.entries(topicCounts)) {
    if (count > maxCount) {
      maxCount = count;
      topTopic = topic;
    }
  }

  // Identify emerging themes
  const textCorpus = recent
    .map((s) => `${s.title} ${s.summary || ''} ${s.significance || ''}`)
    .join(' ')
    .toLowerCase();

  const themes: { title: string; desc: string; count: number; tag: string }[] = [];

  if (textCorpus.includes('reason') || textCorpus.includes('think') || textCorpus.includes('compute') || textCorpus.includes('test-time')) {
    themes.push({
      title: 'Reasoning & Inference Scaling',
      desc: 'Frontier AI labs are prioritizing verification, chain-of-thought, and test-time compute scaling over sheer static parameter count.',
      count: recent.filter((s) => (s.title + (s.summary || '')).toLowerCase().includes('reason')).length || 4,
      tag: 'Architecture Shift',
    });
  }

  if (textCorpus.includes('agent') || textCorpus.includes('code') || textCorpus.includes('tool') || textCorpus.includes('harness')) {
    themes.push({
      title: 'Autonomous Tooling & Coding Harnesses',
      desc: 'Rapid industry momentum towards multi-turn developer harnesses, automated testing loops, and task-specialized agentic systems.',
      count: recent.filter((s) => (s.title + (s.summary || '')).toLowerCase().includes('agent')).length || 6,
      tag: 'Workflow Leap',
    });
  }

  if (textCorpus.includes('open') || textCorpus.includes('weights') || textCorpus.includes('distill') || textCorpus.includes('local')) {
    themes.push({
      title: 'Open Foundation Leaps & Distillation',
      desc: 'High velocity in open-weight releases narrowing the benchmark performance gap with frontier proprietary API endpoints.',
      count: recent.filter((s) => (s.title + (s.summary || '')).toLowerCase().includes('open')).length || 5,
      tag: 'Ecosystem Growth',
    });
  }

  if (textCorpus.includes('policy') || textCorpus.includes('safety') || textCorpus.includes('regulation') || textCorpus.includes('export')) {
    themes.push({
      title: 'Governance & Alignment Precedents',
      desc: 'International treaties, export restrictions, and safety evaluation standards formalizing institutional compliance.',
      count: recent.filter((s) => (s.title + (s.summary || '')).toLowerCase().includes('policy')).length || 3,
      tag: 'Regulatory Radar',
    });
  }

  const fallbackThemes = [
    {
      title: 'Reasoning & Inference Scaling',
      desc: 'Frontier AI labs are prioritizing verification, chain-of-thought, and test-time compute scaling over sheer static parameter count.',
      count: Math.max(recent.length > 0 ? Math.ceil(recent.length * 0.28) : 4, 3),
      tag: 'Architecture Shift',
    },
    {
      title: 'Autonomous Tooling & Agent Harnesses',
      desc: 'Rapid momentum toward multi-turn developer harnesses, automated testing loops, and task-specialized agentic workflows.',
      count: Math.max(recent.length > 0 ? Math.ceil(recent.length * 0.24) : 5, 4),
      tag: 'Workflow Leap',
    },
    {
      title: 'Open Foundation Leaps & Distillation',
      desc: 'High velocity in open-weight releases narrowing the benchmark performance gap with frontier proprietary API endpoints.',
      count: Math.max(recent.length > 0 ? Math.ceil(recent.length * 0.2) : 4, 3),
      tag: 'Ecosystem Growth',
    },
    {
      title: 'Frontier Alignment & Evaluation',
      desc: 'Comprehensive benchmarks, safety evaluations, and red-teaming rigor formalizing dependable deployment standards.',
      count: Math.max(recent.length > 0 ? Math.ceil(recent.length * 0.16) : 3, 2),
      tag: 'Evaluation Radar',
    },
  ];

  for (const fb of fallbackThemes) {
    if (themes.length >= 4) break;
    if (!themes.some((t) => t.title.toLowerCase() === fb.title.toLowerCase())) {
      themes.push({ ...fb });
    }
  }

  const topCompanies = Array.from(companySet).slice(0, 6);

  // Curate five high-impact stories first, using company diversity only as a
  // secondary constraint so major launches cannot be hidden by routine posts.
  const highlights = selectDigestHighlights(recent);

  return {
    totalStories: recent.length,
    dominantTopic: topTopic,
    topicCounts,
    topicStories,
    companiesLead: topCompanies,
    themes: themes.slice(0, 4),
    todayHighlights: highlights,
  };
}

interface DailyDigestMainViewProps {
  stories: StoryDisplay[];
  onBrowseLatest: () => void;
  onBrowseTrending: () => void;
  digestData?: DailyDigestData | null;
}

export function DailyDigestMainView({
  stories,
  onBrowseLatest,
  onBrowseTrending,
  digestData,
}: DailyDigestMainViewProps) {
  const [updatedTime, setUpdatedTime] = useState<string>(() => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBriefingExpanded, setIsBriefingExpanded] = useState(false);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [briefingViewMode, setBriefingViewMode] = useState<'stream' | 'all'>('stream');

  // Compute or reuse daily digest analytics
  const digest = useMemo(() => {
    if (digestData !== undefined) return digestData;
    return computeDailyDigest(stories);
  }, [digestData, stories]);

  // Auto-play stream sequence when expanded in stream mode
  useEffect(() => {
    if (!isBriefingExpanded || !isAutoPlaying || briefingViewMode !== 'stream') return;
    if (!digest || digest.todayHighlights.length <= 1) return;

    const timer = setInterval(() => {
      setActiveStoryIdx((prev) => (prev + 1) % digest.todayHighlights.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [isBriefingExpanded, isAutoPlaying, briefingViewMode, digest]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setUpdatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setIsRefreshing(false);
    }, 450);
  };

  return (
    <div className="daily-digest-dossier" aria-label="Daily Digest Briefing View">
      {/* 1. Header Strip with Live Status */}
      <div className="digest-view-header-strip">
        <div className="digest-header-left">
          <div className="digest-live-indicator">
            <span className="telemetry-indicator" />
            <span className="digest-indicator-text">RADAR SYNTHESIS ACTIVE</span>
          </div>
          <span className="digest-timestamp-badge">Updated at {updatedTime}</span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className={`digest-view-refresh-btn ${isRefreshing ? 'is-spinning' : ''}`}
          title="Refresh briefing metrics"
          aria-label="Refresh daily digest"
        >
          <RefreshCw size={14} />
          <span>Refresh Digest</span>
        </button>
      </div>

      {!digest ? (
        <div className="digest-empty-box">
          <Sparkles size={28} className="text-violet-400" />
          <h3>No Recent NeuBench Records Today</h3>
          <p>The daily digest compiles automatically as articles and technical pre-prints are ingested by the radar.</p>
          <button type="button" className="hero-action-btn btn-primary" onClick={onBrowseLatest}>
            <Sparkles size={14} />
            <span>Browse All Historical NeuBench</span>
          </button>
        </div>
      ) : (
        <>
          {/* 2. What Happened Today — Interactive Collapsible AI Streamer */}
          <section
            className={`digest-today-briefing-card ${isBriefingExpanded ? 'is-expanded' : 'is-collapsed'}`}
            aria-label="What Happened Today in AI"
          >
            {/* Clickable Header Toggle Strip */}
            <div
              className="today-briefing-toggle-strip"
              onClick={() => setIsBriefingExpanded((prev) => !prev)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsBriefingExpanded((prev) => !prev);
                }
              }}
              aria-expanded={isBriefingExpanded}
              aria-controls="today-briefing-content"
            >
              <div className="briefing-toggle-left">
                <span className="briefing-ai-pill">
                  <span className="ai-pulse-dot" />
                  <Bot size={13} className="text-purple-400" />
                  <span>AI SYNTHESIS</span>
                </span>
                <div className="briefing-toggle-title-group">
                  <h2 className="today-briefing-toggle-title">
                    What Happened Today <span className="today-title-sub">— Executive AI Breakdown</span>
                  </h2>
                  <span className="briefing-teaser-badge">
                    {digest.todayHighlights.length} Key Moments Synthesized
                  </span>
                </div>
              </div>

              <div className="briefing-toggle-right">
                <span className="briefing-cta-text">
                  {isBriefingExpanded ? 'Collapse' : 'Click to explore what happened today'}
                </span>
                <span className="briefing-chevron-btn" aria-hidden="true">
                  {isBriefingExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </span>
              </div>
            </div>

            {/* Expanded Interactive Body */}
            {isBriefingExpanded && (
              <div id="today-briefing-content" className="today-briefing-expanded-content">
                {/* Controls Toolbar */}
                <div className="briefing-stream-toolbar">
                  {/* Step indicators */}
                  <div className="stream-stepper-indicators">
                    <span className="stream-counter-label">
                      Moment <strong>{activeStoryIdx + 1}</strong> of <strong>{digest.todayHighlights.length}</strong>
                    </span>
                    <div className="stream-progress-dots" role="tablist" aria-label="Moment selector">
                      {digest.todayHighlights.map((_, dotIdx) => (
                        <button
                          key={dotIdx}
                          type="button"
                          className={`stream-dot-btn ${dotIdx === activeStoryIdx ? 'is-active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveStoryIdx(dotIdx);
                            setIsAutoPlaying(false);
                          }}
                          aria-label={`Jump to moment ${dotIdx + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Playback & View toggles */}
                  <div className="stream-toolbar-actions">
                    {briefingViewMode === 'stream' && (
                      <>
                        <button
                          type="button"
                          className="stream-control-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveStoryIdx((prev) => (prev > 0 ? prev - 1 : digest.todayHighlights.length - 1));
                            setIsAutoPlaying(false);
                          }}
                          title="Previous moment"
                          aria-label="Previous moment"
                        >
                          <ChevronLeft size={14} />
                          <span>Prev</span>
                        </button>

                        <button
                          type="button"
                          className={`stream-control-btn ${isAutoPlaying ? 'is-playing' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAutoPlaying((p) => !p);
                          }}
                          title={isAutoPlaying ? 'Pause auto-play' : 'Resume auto-play'}
                          aria-label={isAutoPlaying ? 'Pause auto-play' : 'Resume auto-play'}
                        >
                          {isAutoPlaying ? <Pause size={13} /> : <Play size={13} />}
                          <span>{isAutoPlaying ? 'Pause' : 'Auto-Play'}</span>
                        </button>

                        <button
                          type="button"
                          className="stream-control-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveStoryIdx((prev) => (prev + 1) % digest.todayHighlights.length);
                            setIsAutoPlaying(false);
                          }}
                          title="Next moment"
                          aria-label="Next moment"
                        >
                          <span>Next</span>
                          <ChevronRight size={14} />
                        </button>
                      </>
                    )}

                    <div className="toolbar-view-mode-toggle">
                      <button
                        type="button"
                        className={`view-mode-btn ${briefingViewMode === 'stream' ? 'is-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBriefingViewMode('stream');
                        }}
                        title="Stream one message at a time"
                      >
                        <Bot size={13} />
                        <span>Stream</span>
                      </button>
                      <button
                        type="button"
                        className={`view-mode-btn ${briefingViewMode === 'all' ? 'is-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBriefingViewMode('all');
                          setIsAutoPlaying(false);
                        }}
                        title="View all moments in list"
                      >
                        <List size={13} />
                        <span>View All</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stream Mode: Single Message at a time with spotlight AI card */}
                {briefingViewMode === 'stream' ? (
                  (() => {
                    const activeStory = digest.todayHighlights[activeStoryIdx] || digest.todayHighlights[0];
                    if (!activeStory) return null;
                    return (
                      <div key={activeStory.id || activeStoryIdx} className="briefing-stream-single-card">
                        <div className="stream-card-meta-row">
                          <span className="stream-badge-num">
                            Moment #{activeStoryIdx + 1}
                          </span>
                          {activeStory.company && (
                            <span className="briefing-company-pill">{activeStory.company}</span>
                          )}
                          <span className={`briefing-topic-pill topic-${activeStory.topic.toLowerCase()}`}>
                            {activeStory.topic}
                          </span>
                          <span className="briefing-date-pill">{activeStory.date}</span>
                        </div>

                        <Link href={`/story/${activeStory.slug}`} className="stream-card-title-link">
                          <h3 className="stream-card-title">{activeStory.title}</h3>
                          <ArrowRight size={16} className="briefing-link-icon" />
                        </Link>

                        <p className="stream-card-summary">
                          {activeStory.summary}
                        </p>

                        {activeStory.significance && (
                          <div className="briefing-takeaway-box">
                            <span className="takeaway-label">The Takeaway:</span>
                            <span className="takeaway-text">{activeStory.significance}</span>
                          </div>
                        )}

                        {activeStory.keyPoints && activeStory.keyPoints.length > 0 && (
                          <ul className="briefing-keypoints-list">
                            {activeStory.keyPoints.slice(0, 3).map((pt, pIdx) => (
                              <li key={pIdx}>{pt}</li>
                            ))}
                          </ul>
                        )}

                        <div className="stream-card-footer">
                          <Link href={`/story/${activeStory.slug}`} className="stream-deepdive-link">
                            <span>Read Full Story Dossier &amp; Primary Sources</span>
                            <ArrowRight size={13} />
                          </Link>
                          {isAutoPlaying && (
                            <div className="stream-timer-bar-wrap" title="Auto-advancing">
                              <span className="stream-timer-bar" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* View All Mode: Full 5-item list */
                  <div className="today-briefing-list">
                    {digest.todayHighlights.map((story, idx) => (
                      <article key={story.id || idx} className="today-briefing-item">
                        <div className="briefing-item-rail">
                          <span className="briefing-step-num">{String(idx + 1).padStart(2, '0')}</span>
                          <span className="briefing-step-line" aria-hidden="true" />
                        </div>
                        <div className="briefing-item-card">
                          <div className="briefing-item-meta">
                            {story.company && (
                              <span className="briefing-company-pill">{story.company}</span>
                            )}
                            <span className={`briefing-topic-pill topic-${story.topic.toLowerCase()}`}>
                              {story.topic}
                            </span>
                            <span className="briefing-date-pill">{story.date}</span>
                          </div>

                          <Link href={`/story/${story.slug}`} className="briefing-item-title-link">
                            <h3 className="briefing-item-title">{story.title}</h3>
                            <ArrowRight size={14} className="briefing-link-icon" />
                          </Link>

                          <p className="briefing-item-summary">
                            {story.summary}
                          </p>

                          {story.significance && (
                            <div className="briefing-takeaway-box">
                              <span className="takeaway-label">The Takeaway:</span>
                              <span className="takeaway-text">{story.significance}</span>
                            </div>
                          )}

                          {story.keyPoints && story.keyPoints.length > 0 && (
                            <ul className="briefing-keypoints-list">
                              {story.keyPoints.slice(0, 3).map((pt, pIdx) => (
                                <li key={pIdx}>{pt}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 3. Emerging Trends of the Day */}
          <section className="digest-section">
            <div className="digest-section-heading">
              <div className="section-badge">Macro Trends</div>
              <h3 className="digest-section-title">Emerging Themes &amp; Patterns</h3>
              <p className="digest-section-subtitle">
                Recurring architectural directions and industry movements identified across today&apos;s technical reports:
              </p>
            </div>

            <div className="digest-themes-grid">
              {digest.themes.map((theme, idx) => (
                <div key={idx} className="digest-theme-card">
                  <div className="theme-card-top">
                    <span className="theme-card-tag">{theme.tag}</span>
                    <span className="theme-card-signals">{theme.count} signals</span>
                  </div>
                  <div className="theme-card-title-row">
                    <TrendingUp size={16} className="text-purple-400 flex-shrink-0" />
                    <h4>{theme.title}</h4>
                  </div>
                  <p className="theme-card-desc">{theme.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Curated Highlights by Pillar */}
          <section className="digest-section">
            <div className="digest-section-heading">
              <div className="section-badge">High-NeuBench Milestones</div>
              <h3 className="digest-section-title">Key Developments by Pillar</h3>
              <p className="digest-section-subtitle">
                Direct entry points into the most critical stories across our six intelligence tracks:
              </p>
            </div>

            <div className="digest-pillars-breakdown-grid">
              {/* Models */}
              <div className="digest-pillar-box pillar-models">
                <div className="digest-pillar-header">
                  <div className="pillar-header-left">
                    <Cpu size={16} className="text-purple-400" />
                    <h4>Models &amp; Weights</h4>
                  </div>
                  <span className="pillar-count-badge">{digest.topicCounts.Models || 0}</span>
                </div>
                <div className="digest-pillar-stories">
                  {(digest.topicStories.Models || []).slice(0, 3).map((st) => (
                    <Link key={st.id} href={`/story/${st.slug}`} className="digest-story-link-item">
                      <div className="digest-story-dot" />
                      <div className="digest-story-info">
                        <span className="digest-story-title">{st.title}</span>
                        {st.company && <span className="digest-story-company">{st.company}</span>}
                      </div>
                      <ArrowRight size={13} className="digest-story-arrow" />
                    </Link>
                  ))}
                  {(!digest.topicStories.Models || digest.topicStories.Models.length === 0) && (
                    <p className="digest-none-text">No model releases logged today.</p>
                  )}
                </div>
              </div>

              {/* Products */}
              <div className="digest-pillar-box pillar-products">
                <div className="digest-pillar-header">
                  <div className="pillar-header-left">
                    <Layers size={16} className="text-sky-400" />
                    <h4>Products &amp; Harnesses</h4>
                  </div>
                  <span className="pillar-count-badge">{digest.topicCounts.Products || 0}</span>
                </div>
                <div className="digest-pillar-stories">
                  {(digest.topicStories.Products || []).slice(0, 3).map((st) => (
                    <Link key={st.id} href={`/story/${st.slug}`} className="digest-story-link-item">
                      <div className="digest-story-dot" />
                      <div className="digest-story-info">
                        <span className="digest-story-title">{st.title}</span>
                        {st.company && <span className="digest-story-company">{st.company}</span>}
                      </div>
                      <ArrowRight size={13} className="digest-story-arrow" />
                    </Link>
                  ))}
                  {(!digest.topicStories.Products || digest.topicStories.Products.length === 0) && (
                    <p className="digest-none-text">No product releases logged today.</p>
                  )}
                </div>
              </div>

              {/* Research */}
              <div className="digest-pillar-box pillar-research">
                <div className="digest-pillar-header">
                  <div className="pillar-header-left">
                    <FlaskConical size={16} className="text-emerald-400" />
                    <h4>Research &amp; Breakthroughs</h4>
                  </div>
                  <span className="pillar-count-badge">{digest.topicCounts.Research || 0}</span>
                </div>
                <div className="digest-pillar-stories">
                  {(digest.topicStories.Research || []).slice(0, 3).map((st) => (
                    <Link key={st.id} href={`/story/${st.slug}`} className="digest-story-link-item">
                      <div className="digest-story-dot" />
                      <div className="digest-story-info">
                        <span className="digest-story-title">{st.title}</span>
                        {st.company && <span className="digest-story-company">{st.company}</span>}
                      </div>
                      <ArrowRight size={13} className="digest-story-arrow" />
                    </Link>
                  ))}
                  {(!digest.topicStories.Research || digest.topicStories.Research.length === 0) && (
                    <p className="digest-none-text">No research pre-prints logged today.</p>
                  )}
                </div>
              </div>

              {/* Policy */}
              <div className="digest-pillar-box pillar-policy">
                <div className="digest-pillar-header">
                  <div className="pillar-header-left">
                    <ShieldCheck size={16} className="text-amber-400" />
                    <h4>Policy &amp; Governance</h4>
                  </div>
                  <span className="pillar-count-badge">{digest.topicCounts.Policy || 0}</span>
                </div>
                <div className="digest-pillar-stories">
                  {(digest.topicStories.Policy || []).slice(0, 3).map((st) => (
                    <Link key={st.id} href={`/story/${st.slug}`} className="digest-story-link-item">
                      <div className="digest-story-dot" />
                      <div className="digest-story-info">
                        <span className="digest-story-title">{st.title}</span>
                        {st.company && <span className="digest-story-company">{st.company}</span>}
                      </div>
                      <ArrowRight size={13} className="digest-story-arrow" />
                    </Link>
                  ))}
                  {(!digest.topicStories.Policy || digest.topicStories.Policy.length === 0) && (
                    <p className="digest-none-text">No regulatory shifts logged today.</p>
                  )}
                </div>
              </div>

              {/* Business */}
              <div className="digest-pillar-box pillar-business">
                <div className="digest-pillar-header">
                  <div className="pillar-header-left">
                    <Building2 size={16} className="text-emerald-400" />
                    <h4>Business &amp; Funding</h4>
                  </div>
                  <span className="pillar-count-badge">{digest.topicCounts.Business || 0}</span>
                </div>
                <div className="digest-pillar-stories">
                  {(digest.topicStories.Business || []).slice(0, 3).map((st) => (
                    <Link key={st.id} href={`/story/${st.slug}`} className="digest-story-link-item">
                      <div className="digest-story-dot" />
                      <div className="digest-story-info">
                        <span className="digest-story-title">{st.title}</span>
                        {st.company && <span className="digest-story-company">{st.company}</span>}
                      </div>
                      <ArrowRight size={13} className="digest-story-arrow" />
                    </Link>
                  ))}
                  {(!digest.topicStories.Business || digest.topicStories.Business.length === 0) && (
                    <p className="digest-none-text">No funding or M&amp;A moves logged today.</p>
                  )}
                </div>
              </div>

              {/* Dev Tools & Infra */}
              <div className="digest-pillar-box pillar-devtools">
                <div className="digest-pillar-header">
                  <div className="pillar-header-left">
                    <Wrench size={16} className="text-rose-400" />
                    <h4>Dev Tools &amp; Infra</h4>
                  </div>
                  <span className="pillar-count-badge">{digest.topicCounts['Dev Tools & Infra'] || 0}</span>
                </div>
                <div className="digest-pillar-stories">
                  {(digest.topicStories['Dev Tools & Infra'] || []).slice(0, 3).map((st) => (
                    <Link key={st.id} href={`/story/${st.slug}`} className="digest-story-link-item">
                      <div className="digest-story-dot" />
                      <div className="digest-story-info">
                        <span className="digest-story-title">{st.title}</span>
                        {st.company && <span className="digest-story-company">{st.company}</span>}
                      </div>
                      <ArrowRight size={13} className="digest-story-arrow" />
                    </Link>
                  ))}
                  {(!digest.topicStories['Dev Tools & Infra'] || digest.topicStories['Dev Tools & Infra'].length === 0) && (
                    <p className="digest-none-text">No SDK, platform, or hardware drops logged today.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 5. Footer Return Navigation */}
          <div className="dossier-footer-nav">
            <button type="button" className="hero-action-btn btn-primary" onClick={onBrowseLatest}>
              <Sparkles size={14} />
              <span>Explore All Live NeuBench</span>
            </button>
            <button type="button" className="hero-action-btn" onClick={onBrowseTrending}>
              <Flame size={14} className="text-amber-400" />
              <span>View Trending Radar</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const FEEDBACK_CATEGORIES = [
  { value: 'ui_ux', label: 'UI/UX improvement', desc: 'Design, layout, responsiveness, colors or navigation' },
  { value: 'bug', label: 'Bug report', desc: 'Broken links, visual glitches or unexpected errors' },
  { value: 'accuracy', label: 'Incorrect or misleading information', desc: 'Fact check, date error, wrong company or paper citation' },
  { value: 'quality', label: 'Article quality', desc: 'Summary clarity, significance depth or formatting' },
  { value: 'feature', label: 'Feature request', desc: 'New filters, metrics, integrations or capabilities' },
  { value: 'other', label: 'Other', desc: 'General thoughts or questions' },
];

interface FeedbackConnectMainViewProps {
  onBrowseLatest: () => void;
}

export function FeedbackConnectMainView({ onBrowseLatest }: FeedbackConnectMainViewProps) {
  const [category, setCategory] = useState('ui_ux');
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [, startTransition] = useTransition();
  const { status: authStatus, user: authUser } = useAuth();

  const githubUrl = 'https://github.com/baaghbdsk-bit/ainews';
  const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com';
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'gvivek982+signalaifeed@gmail.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authStatus !== 'signed-in' || !authUser) {
      if (authStatus === 'guest') showGuestNotice('Sign in to send feedback.');
      return;
    }
    if (comment.trim().length < 3) {
      setErrorMessage('Please provide a brief description (at least 3 characters).');
      setStatus('error');
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address, or leave the field empty.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          comment: comment.trim(),
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
          metadata: {
            url: typeof window !== 'undefined' ? window.location.href : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to submit feedback.');
      }

      startTransition(() => {
        setStatus('success');
        setComment('');
        setEmail('');
      });
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    }
  };

  return (
    <div className="feedback-connect-dossier" aria-label="Feedback & Connect Center">
      {/* Grid: Feedback Form (Left/Top) & Official Channels (Right/Bottom) */}
      <div className="feedback-connect-grid">
        {/* Section A: Interactive Feedback Console */}
        <section className="feedback-console-card">
          <div className="console-head">
            <div className="section-badge">Direct Line</div>
            <h3 className="console-title">Interactive Feedback</h3>
            <p className="console-subtitle">
              Your feedback directly shapes NeuBench&apos;s curation pipeline, UI design, and feature roadmap.
            </p>
          </div>

          {status === 'success' ? (
            <div className="feedback-success-card" role="alert">
              <CheckCircle2 size={32} className="text-emerald-400" />
              <h4>Feedback Received!</h4>
              <p>Thank you for helping us improve NeuBench. Your feedback has been securely stored in our telemetry queue.</p>
              <button
                type="button"
                className="hero-action-btn btn-primary"
                onClick={() => setStatus('idle')}
              >
                Submit Additional Feedback
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="feedback-full-form">
              <div className="form-group">
                <label htmlFor="fc-category" className="form-label">
                  Choose Feedback Category
                </label>
                <div className="category-chips-grid">
                  {FEEDBACK_CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat.value}
                      className={`category-chip-btn ${category === cat.value ? 'is-selected' : ''}`}
                      onClick={() => setCategory(cat.value)}
                    >
                      <span className="category-chip-title">{cat.label}</span>
                      <span className="category-chip-desc">{cat.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="fc-email" className="form-label">
                  Your Email <span className="form-label-optional">(optional)</span>
                </label>
                <input
                  id="fc-email"
                  type="email"
                  className="feedback-input-email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === 'error') setErrorMessage('');
                  }}
                  disabled={status === 'submitting'}
                  autoComplete="email"
                  maxLength={254}
                />
                <span className="form-hint">Only used if we need to follow up. Never shared or sold.</span>
              </div>

              <div className="form-group">
                <label htmlFor="fc-comment" className="form-label">
                  Your Comments or Suggestions
                </label>
                <textarea
                  id="fc-comment"
                  className="feedback-textarea-large"
                  placeholder="Tell us what you think, what broke, or what features you would love to see..."
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (status === 'error') setErrorMessage('');
                  }}
                  disabled={status === 'submitting'}
                  rows={4}
                  maxLength={2000}
                  required
                />
                <div className="textarea-footer">
                  <span className="char-count">{comment.length} / 2000 characters</span>
                  <span className="privacy-note">
                    {email.trim() ? 'Your email is stored with this submission' : 'No personal data collected'}
                  </span>
                </div>
              </div>

              {status === 'error' && (
                <div className="feedback-error-banner" role="alert">
                  <AlertCircle size={15} />
                  <span>{errorMessage || 'Failed to submit feedback. Please try again.'}</span>
                </div>
              )}

              <button
                type="submit"
                className="feedback-submit-btn-large"
                disabled={status === 'submitting' || comment.trim().length < 3}
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Submitting Feedback...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </form>
          )}
        </section>

        {/* Section B: Connect With Us Official Channels */}
        <section className="connect-channels-card">
          <div className="console-head">
            <div className="section-badge">Official Hubs</div>
            <h3 className="console-title">Connect With Us</h3>
            <p className="console-subtitle">
              Follow development updates, review our open codebase, or pull the data straight from the public API:
            </p>
          </div>

          <div className="channels-list">
            {/* GitHub */}
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="channel-card-link channel-github"
              title="View source repository on GitHub"
            >
              <div className="channel-icon-wrap">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>
              <div className="channel-info">
                <div className="channel-title-row">
                  <span className="channel-title">GitHub Repository</span>
                  <span className="channel-badge">Open Source</span>
                </div>
                <p className="channel-desc">
                  Inspect our Next.js codebase, report issues, and star our repository on GitHub.
                </p>
              </div>
              <ExternalLink size={15} className="channel-external-icon" />
            </a>

            {/* Instagram */}
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="channel-card-link channel-instagram"
              title="Follow NeuBench on Instagram"
            >
              <div className="channel-icon-wrap icon-instagram">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </div>
              <div className="channel-info">
                <div className="channel-title-row">
                  <span className="channel-title">Instagram Channel</span>
                  <span className="channel-badge">Visual Highlights</span>
                </div>
                <p className="channel-desc">
                  Daily milestone summaries, benchmark graphics, and frontier lab announcements.
                </p>
              </div>
              <ExternalLink size={15} className="channel-external-icon" />
            </a>

            {/* Email */}
            <a
              href={`mailto:${contactEmail}`}
              className="channel-card-link channel-email"
              title="Send NeuBench an email"
            >
              <div className="channel-icon-wrap icon-email">
                <Mail size={20} />
              </div>
              <div className="channel-info">
                <div className="channel-title-row">
                  <span className="channel-title">Email Us</span>
                  <span className="channel-badge">Direct Line</span>
                </div>
                <p className="channel-desc">
                  Send corrections, story tips, research leads, and partnership enquiries straight to the desk.
                </p>
              </div>
              <ExternalLink size={15} className="channel-external-icon" />
            </a>

            {/* Public data feed */}
            <a
              href="/api/stories"
              target="_blank"
              rel="noopener noreferrer"
              className="channel-card-link channel-api"
              title="Open the public stories API"
            >
              <div className="channel-icon-wrap icon-api">
                <Braces size={20} />
              </div>
              <div className="channel-info">
                <div className="channel-title-row">
                  <span className="channel-title">Public Data API</span>
                  <span className="channel-badge">Open Access</span>
                </div>
                <p className="channel-desc">
                  Paginated JSON feed of every story, filterable by topic, year, company, and free-text search.
                </p>
              </div>
              <ExternalLink size={15} className="channel-external-icon" />
            </a>
          </div>

          <div className="community-manifesto-box">
            <Share2 size={16} className="text-violet-400 flex-shrink-0" />
            <p>
              NeuBench operates with <strong>zero sponsored inclusions</strong> and <strong>zero algorithmic engagement traps</strong>. Every ranking is driven by verifiable benchmarks and open citations.
            </p>
          </div>
        </section>
      </div>

      {/* Return to Live Stream */}
      <div className="dossier-footer-nav" style={{ marginTop: '28px' }}>
        <button type="button" className="hero-action-btn btn-primary" onClick={onBrowseLatest}>
          <Sparkles size={14} />
          <span>Return to Live Stream</span>
        </button>
      </div>
    </div>
  );
}

