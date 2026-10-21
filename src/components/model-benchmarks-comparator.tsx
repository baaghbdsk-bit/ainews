'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  BarChart2,
  SlidersHorizontal,
  Compass,
  Zap,
  Layers,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  Check,
  Plus,
  RotateCcw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { AI_MODELS_DATA, BENCHMARK_DEFINITIONS } from '@/lib/benchmarks/data';
import type { BenchmarkCategory } from '@/lib/benchmarks/types';
import { ModelRadarGraph } from './benchmarks/model-radar-graph';
import { ModelQuadrantChart } from './benchmarks/model-quadrant-chart';
import { BenchmarkGridCard } from './benchmarks/benchmark-grid-card';
import { BenchmarkSpecsTable } from './benchmarks/benchmark-specs-table';
import { CatalogueFreshness } from './benchmarks/catalogue-freshness';
import type { CatalogueFreshnessAudit } from './benchmarks/catalogue-freshness';
import { getCatalogueAudit } from '@/lib/benchmarks/service';
import { HeroBenchmarksArt } from './hero-arts';

type ViewMode = 'grid' | 'radar' | 'quadrant' | 'specs';

const rankedBy = (benchmarkId: string, models: typeof AI_MODELS_DATA = AI_MODELS_DATA) =>
  models
    .filter((m) => m.benchmarks && m.benchmarks[benchmarkId])
    .sort((a, b) => b.benchmarks[benchmarkId].score - a.benchmarks[benchmarkId].score);

const topIds = (
  benchmarkId: string,
  count = 4,
  predicate?: (m: (typeof AI_MODELS_DATA)[number]) => boolean
) => {
  const pool = predicate ? AI_MODELS_DATA.filter(predicate) : AI_MODELS_DATA;
  const ranked = rankedBy(benchmarkId, pool).slice(0, count).map((m) => m.id);
  if (ranked.length > 0) return ranked;
  const fallback = rankedBy('aa-intelligence', pool).slice(0, count).map((m) => m.id);
  if (fallback.length > 0) return fallback;
  return pool.slice(0, count).map((m) => m.id);
};

const COMPARISON_PRESETS = [
  {
    id: 'frontier',
    label: '👑 Frontier Leaders',
    desc: 'Highest artificial-analysis intelligence indices',
    modelIds: topIds('aa-intelligence'),
  },
  {
    id: 'open-weights',
    label: '🔓 Open Weights Leaders',
    desc: 'Strongest models with downloadable weights',
    modelIds: topIds('aa-intelligence', 4, (m) => m.specs.isOpenWeights),
  },
  {
    id: 'coding',
    label: '💻 Coding Champions',
    desc: 'Top software-engineering index scores',
    modelIds: topIds('aa-coding'),
  },
  {
    id: 'fast-cheap',
    label: '⚡ Fast & Low Cost',
    desc: 'Efficient models with strong intelligence scores',
    modelIds: topIds('aa-intelligence', 4, (m) => m.specs.capabilities.includes('Efficient')),
  },
];

const CATEGORY_ORDER: BenchmarkCategory[] = [
  'Coding',
  'Agentic',
  'Reasoning',
  'Mathematics',
  'General Knowledge',
  'Human Preference',
];

const ALL_BENCHMARKS = Object.values(BENCHMARK_DEFINITIONS);

const DEVELOPER_COUNTS = AI_MODELS_DATA.reduce<Record<string, number>>((acc, m) => {
  acc[m.developer] = (acc[m.developer] ?? 0) + 1;
  return acc;
}, {});

const LAB_FILTERS = [
  { label: 'All Labs', value: 'All' },
  ...Object.entries(DEVELOPER_COUNTS)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([developer]) => ({ label: developer, value: developer })),
  { label: 'Open Weights', value: 'OpenWeights' },
];

interface ModelBenchmarksComparatorProps {
  initialView?: ViewMode;
  embedded?: boolean;
  /**
   * Catalogue freshness. Supplied by the server, which is the only place
   * that may read the clock: a value derived from Date.now() during a client
   * render would disagree with the server render and break prerendering.
   */
  audit?: CatalogueFreshnessAudit;
}

export function ModelBenchmarksComparator({
  initialView,
  embedded = false,
  audit,
}: ModelBenchmarksComparatorProps = {}) {
  // Deterministic fallback for the embedded (client-only) mount, which has no
  // server pass-through.
  const freshness: CatalogueFreshnessAudit = audit ?? getCatalogueAudit();
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(() =>
    topIds('aa-intelligence')
  );

  const [viewMode, setViewMode] = useState<ViewMode>(initialView || 'grid');
  const [selectedBenchmarkIds, setSelectedBenchmarkIds] = useState<string[]>(() =>
    ALL_BENCHMARKS.map((b) => b.id)
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', mode);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Search & filter state inside drawer
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLabFilter, setActiveLabFilter] = useState('All');
  const [drawerNotice, setDrawerNotice] = useState<string | null>(null);
  const noticeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const showNotice = (msg: string) => {
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    setDrawerNotice(msg);
    noticeTimeoutRef.current = setTimeout(() => {
      setDrawerNotice(null);
    }, 3500);
  };

  // Keyboard escape listener to dismiss model drawer or benchmark picker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDrawerOpen) {
          setIsDrawerOpen(false);
        } else if (isFilterExpanded) {
          setIsFilterExpanded(false);
        }
      }
    };

    if (isDrawerOpen || isFilterExpanded) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isDrawerOpen, isFilterExpanded]);

  // Dismiss drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDrawerOpen && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.bench-control-toggle') && !target.closest('.bench-model-add')) {
          setIsDrawerOpen(false);
        }
      }
    };

    if (isDrawerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDrawerOpen]);

  const toggleModel = (id: string) => {
    if (selectedModelIds.includes(id)) {
      if (selectedModelIds.length > 1) {
        setSelectedModelIds(selectedModelIds.filter((m) => m !== id));
        setDrawerNotice(null);
      } else {
        showNotice('At least 1 model must remain selected for comparison.');
      }
    } else {
      if (selectedModelIds.length < 5) {
        setSelectedModelIds([...selectedModelIds, id]);
        setDrawerNotice(null);
      } else {
        showNotice('Maximum 5 models can be compared at once. Deselect a model first.');
      }
    }
  };

  const applyPreset = (modelIds: string[]) => {
    setSelectedModelIds(modelIds);
  };

  const selectedModels = useMemo(() => {
    const list = AI_MODELS_DATA.filter((m) => selectedModelIds.includes(m.id));
    if (list.length > 0) return list;
    const defaultIds = topIds('aa-intelligence');
    const fallbackList = AI_MODELS_DATA.filter((m) => defaultIds.includes(m.id));
    return fallbackList.length > 0 ? fallbackList.slice(0, 4) : AI_MODELS_DATA.slice(0, 4);
  }, [selectedModelIds]);

  const benchmarkList = useMemo(
    () => ALL_BENCHMARKS.filter((b) => selectedBenchmarkIds.includes(b.id)),
    [selectedBenchmarkIds]
  );

  const benchmarkGroups = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: ALL_BENCHMARKS.filter((b) => b.category === category),
      })).filter((group) => group.items.length > 0),
    []
  );

  const toggleBenchmark = (id: string) => {
    setSelectedBenchmarkIds((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((x) => x !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const toggleBenchmarkGroup = (ids: string[]) => {
    setSelectedBenchmarkIds((prev) => {
      const allOn = ids.every((id) => prev.includes(id));
      if (allOn) {
        const next = prev.filter((id) => !ids.includes(id));
        return next.length > 0 ? next : prev;
      }
      return Array.from(new Set([...prev, ...ids]));
    });
  };

  const selectAllBenchmarks = () => setSelectedBenchmarkIds(ALL_BENCHMARKS.map((b) => b.id));

  const resetComparison = () => {
    setSelectedBenchmarkIds(ALL_BENCHMARKS.map((b) => b.id));
    setSelectedModelIds(COMPARISON_PRESETS[0].modelIds);
  };

  const filteredDrawerModels = useMemo(() => {
    let list = AI_MODELS_DATA;

    if (activeLabFilter === 'OpenWeights') {
      list = list.filter((m) => m.specs.isOpenWeights);
    } else if (activeLabFilter !== 'All') {
      list = list.filter((m) => m.developer === activeLabFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.developer.toLowerCase().includes(q) ||
          m.tagline.toLowerCase().includes(q) ||
          (m.aliases && m.aliases.some((a) => a.toLowerCase().includes(q)))
      );
    }

    return list;
  }, [searchQuery, activeLabFilter]);

  return (
    <div
      className={`benchmarks-container${embedded ? ' is-embedded' : ''}`}
      aria-label="AI Model Benchmarks Comparator"
    >
      {/* ── 01. Hero Header with Animated Art & Metric Stats ── */}
      <header className="bench-header-panel" aria-label="Frontier Model Benchmarks Header">
        <div className="bench-header-content">
          <div className="bench-header-brand">
            <span className="bench-badge-chip">
              <Sparkles size={12} className="text-rose-400" />
              <span>Audited Model Intelligence</span>
            </span>
            <h1 className="bench-headline">
              Frontier Model Benchmarks.
              <br />
              <span className="bench-title-accent">Living Capability Radar.</span>
            </h1>
            <p className="bench-lede">
              Side-by-side empirical performance across {AI_MODELS_DATA.length} frontier reasoning, coding, and open-weights models. Every score cites official technical reports or LMSYS evaluations.
            </p>

            {/* Brought down below the description */}
            <div className="bench-header-metrics-strip" aria-label="Benchmark summary metrics">
              <div className="bench-metric-chip">
                <span className="metric-val">{AI_MODELS_DATA.length}</span>
                <span className="metric-lbl">Models Audited</span>
              </div>
              <div className="bench-metric-chip">
                <span className="metric-val">{ALL_BENCHMARKS.length}</span>
                <span className="metric-lbl">Benchmarks</span>
              </div>
              <div className="bench-metric-chip is-verified">
                <ShieldCheck size={15} className="text-emerald-400" />
                <span className="metric-val">100%</span>
                <span className="metric-lbl">Verified Sources</span>
              </div>
            </div>
          </div>

          <div className="bench-header-art-wrap">
            <HeroBenchmarksArt />
          </div>
        </div>
      </header>

      {/* ── 03. Unified Comparison Controls (Models & Benchmarks) ── */}
      <section
        className={`bench-panel-card bench-unified-filter-panel ${isFilterExpanded ? 'is-expanded' : 'is-collapsed'}`}
        aria-label="Models and Benchmarks Configuration"
      >
        {/* Top Header Strip: Common and Identical in both Collapsed and Expanded states */}
        <div className="bench-unified-header-strip">
          <div className="bench-unified-header-title">
            <span className="bench-control-label">Models & Benchmarks</span>
            <div className="bench-selected-highlights" aria-label="Selection summary">
              <span className="bench-highlight-badge badge-models" title={`${selectedModels.length} models selected for comparison`}>
                <span className="badge-dot dot-models" aria-hidden="true" />
                <span className="badge-val">{selectedModels.length}</span>
                <span className="badge-lbl">Models</span>
              </span>
              <span className="bench-highlight-badge badge-benchmarks" title={`${benchmarkList.length} benchmark test suites active`}>
                <span className="badge-dot dot-benchmarks" aria-hidden="true" />
                <span className="badge-val">{benchmarkList.length}</span>
                <span className="badge-lbl">Benchmarks</span>
              </span>
              <span className="bench-highlight-status">Selected</span>
            </div>
          </div>

          <div className="bench-unified-header-actions">
            <button
              type="button"
              onClick={() => {
                setIsFilterExpanded((v) => !v);
                if (isFilterExpanded) setIsDrawerOpen(false);
              }}
              className={`bench-unified-toggle-btn ${isFilterExpanded ? 'is-active' : ''}`}
              aria-expanded={isFilterExpanded}
            >
              <SlidersHorizontal size={14} />
              <span>{isFilterExpanded ? 'Collapse Filters' : 'Configure Filters'}</span>
              {isFilterExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Expanded Body: BOTH Models and Benchmark Suites side-by-side / stacked in one card */}
        {isFilterExpanded && (
          <div className="bench-unified-expanded-body">
            {/* 1. Models Sub-section */}
            <div className="bench-unified-subsection">
              <div className="bench-subsection-head">
                <div className="bench-subsection-title">
                  <span className="bench-subsection-label">AI Models</span>
                  <span className="bench-control-hint">{selectedModels.length} of 5 compared</span>
                </div>
                <div className="bench-presets-group">
                  <span className="bench-presets-label">Presets:</span>
                  {COMPARISON_PRESETS.slice(0, 3).map((p) => {
                    const isActive =
                      p.modelIds.length === selectedModelIds.length &&
                      p.modelIds.every((id) => selectedModelIds.includes(id));
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => applyPreset(p.modelIds)}
                        className={`bench-preset-link preset-${p.id} ${isActive ? 'is-active' : ''}`}
                        title={p.desc}
                      >
                        {p.label.replace(/^[^\s]+\s/, '')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bench-model-row">
                {selectedModels.map((m) => (
                  <div key={m.id} className="active-model-tag">
                    <span
                      className={`model-color-dot fill-${m.developerColor}`}
                      aria-hidden="true"
                    />
                    <span className="active-tag-name">{m.name}</span>
                    <a
                      href={m.officialSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="active-tag-src"
                      title={`View official report: ${m.name}`}
                    >
                      <span>Src</span>
                      <ExternalLink size={9} />
                    </a>
                    {selectedModelIds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleModel(m.id)}
                        className="active-tag-remove"
                        title={`Remove ${m.name}`}
                        aria-label={`Remove ${m.name} from comparison`}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
                {selectedModelIds.length < 5 && (
                  <button
                    type="button"
                    className="bench-model-add"
                    onClick={() => setIsDrawerOpen(true)}
                  >
                    <Plus size={12} />
                    <span>Add model</span>
                  </button>
                )}
              </div>

              {/* Model Search & Selection Drawer */}
              {isDrawerOpen && (
                <div
                  ref={drawerRef}
                  className="model-selection-drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="drawer-heading"
                >
                  <div className="drawer-header-strip">
                    <div className="drawer-capacity-badge">
                      <h4 id="drawer-heading" className="sr-only">
                        Select Models to Compare
                      </h4>
                      <span>
                        Comparing: <strong>{selectedModelIds.length}/5 models</strong>
                      </span>
                      {selectedModelIds.length >= 5 && (
                        <span className="capacity-max-tag">Max reached</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="drawer-close-btn"
                      onClick={() => setIsDrawerOpen(false)}
                      aria-label="Close model selection drawer"
                    >
                      <X size={13} />
                      <span>Done</span>
                    </button>
                  </div>

                  {drawerNotice && (
                    <div className="drawer-alert-banner" role="status" aria-live="polite">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span>{drawerNotice}</span>
                    </div>
                  )}

                  <div className="drawer-filter-row">
                    <div className="drawer-search-box">
                      <Search size={13} className="drawer-search-icon" />
                      <input
                        type="text"
                        placeholder="Search model, provider or architecture (e.g. Claude, o1, Qwen, MoE)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="drawer-search-input"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="drawer-search-clear"
                          aria-label="Clear search query"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="drawer-filter-pills">
                      {LAB_FILTERS.map((f) => (
                        <button
                          type="button"
                          key={f.value}
                          onClick={() => setActiveLabFilter(f.value)}
                          className={`drawer-pill-filter ${activeLabFilter === f.value ? 'is-active' : ''}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Model Selection Chips Grid */}
                  <div className="drawer-chips-grid">
                    {filteredDrawerModels.map((m) => {
                      const isSelected = selectedModelIds.includes(m.id);
                      const isMax = selectedModelIds.length >= 5 && !isSelected;

                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => {
                            if (isMax) {
                              showNotice('Maximum 5 models can be compared at once. Deselect a model first.');
                            } else {
                              toggleModel(m.id);
                            }
                          }}
                          aria-pressed={isSelected}
                          aria-disabled={isMax}
                          className={`drawer-model-chip ${isSelected ? 'is-selected' : ''} ${
                            isMax ? 'is-disabled' : ''
                          }`}
                        >
                          <div className="drawer-chip-left">
                            <span
                              className={`model-color-dot fill-${m.developerColor}`}
                              aria-hidden="true"
                            />
                            <span className="drawer-chip-name">{m.name}</span>
                          </div>

                          <div className="drawer-chip-right">
                            <span className="drawer-chip-dev">{m.developer}</span>
                            {isSelected && <CheckCircle2 size={13} className="text-purple-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Divider between Models and Benchmarks */}
            <div className="bench-unified-divider" />

            {/* 2. Benchmark Suites Sub-section */}
            <div className="bench-unified-subsection">
              <div className="bench-subsection-head">
                <div className="bench-subsection-title">
                  <span className="bench-subsection-label">Benchmark Test Suites</span>
                  <span className="bench-control-hint">
                    {benchmarkList.length} of {ALL_BENCHMARKS.length} active
                  </span>
                </div>
                <div className="bench-subsection-actions">
                  <button
                    type="button"
                    onClick={selectAllBenchmarks}
                    className="bench-control-link"
                    title="Select all 10 benchmarks"
                  >
                    <Check size={12} />
                    <span>Select all</span>
                  </button>
                  {benchmarkList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedBenchmarkIds([ALL_BENCHMARKS[0].id])}
                      className="bench-control-link"
                      title="Clear to 1 benchmark"
                    >
                      <X size={12} />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="bench-picker-groups is-expanded">
                {benchmarkGroups.map((group) => {
                  const selectedInGroup = group.items.filter((b) =>
                    selectedBenchmarkIds.includes(b.id)
                  ).length;
                  const allOn = selectedInGroup === group.items.length;
                  const catSlug = group.category.toLowerCase().replace(/\s+/g, '-');

                  return (
                    <div className={`bench-category-card cat-${catSlug}`} key={group.category}>
                      <div className="bench-category-card-head">
                        <span className="bench-category-card-name">{group.category}</span>
                        <button
                          type="button"
                          onClick={() => toggleBenchmarkGroup(group.items.map((b) => b.id))}
                          className={`bench-category-toggle-btn ${selectedInGroup > 0 ? 'is-active' : 'is-empty'}`}
                          aria-pressed={allOn}
                          title={
                            allOn
                              ? `Deselect all ${group.category} benchmarks`
                              : `Select all ${group.category} benchmarks`
                          }
                        >
                          {selectedInGroup}/{group.items.length}
                        </button>
                      </div>

                      <div className="bench-picker-chips">
                        {group.items.map((benchmark) => {
                          const isOn = selectedBenchmarkIds.includes(benchmark.id);
                          return (
                            <button
                              type="button"
                              key={benchmark.id}
                              onClick={() => toggleBenchmark(benchmark.id)}
                              className={`bench-picker-chip ${isOn ? 'is-on' : ''}`}
                              aria-pressed={isOn}
                              title={`${benchmark.name} — ${benchmark.whatItMeasures}`}
                            >
                              <span className="bench-picker-chip-mark">
                                {isOn && <Check size={10} />}
                              </span>
                              <span>{benchmark.shortName}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>



      {/* ── 05. Interactive View Switcher Toolbar ── */}
      <section className="bench-views-toolbar" aria-label="Benchmark Visualizations Toolbar">
        <div className="views-segmented-control" role="tablist" aria-label="Benchmark Visualizations">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'grid'}
            onClick={() => handleViewChange('grid')}
            className={`view-tab-btn view-tab-grid ${viewMode === 'grid' ? 'is-active' : ''}`}
          >
            <BarChart2 size={16} />
            <span>Benchmark Grid</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'radar'}
            onClick={() => handleViewChange('radar')}
            className={`view-tab-btn view-tab-radar ${viewMode === 'radar' ? 'is-active' : ''}`}
          >
            <Compass size={16} />
            <span>Capability Radar</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'quadrant'}
            onClick={() => handleViewChange('quadrant')}
            className={`view-tab-btn view-tab-quadrant ${viewMode === 'quadrant' ? 'is-active' : ''}`}
          >
            <Zap size={16} />
            <span>Capability vs Price</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'specs'}
            onClick={() => handleViewChange('specs')}
            className={`view-tab-btn view-tab-specs ${viewMode === 'specs' ? 'is-active' : ''}`}
          >
            <Layers size={16} />
            <span>Technical Specs</span>
          </button>
        </div>
      </section>

      {/* ── 06. Dynamic Main Visual Display ── */}
      <main className="bench-main-content">
        {/* VIEW 1: Benchmark Grid of Cards */}
        {viewMode === 'grid' && (
          <div className="benchmarks-matrix-grid">
            {benchmarkList.map((benchmark) => (
              <BenchmarkGridCard
                key={benchmark.id}
                benchmark={benchmark}
                selectedModels={selectedModels}
              />
            ))}
          </div>
        )}

        {/* VIEW 2: Radar Graph */}
        {viewMode === 'radar' && (
          <ModelRadarGraph selectedModels={selectedModels} />
        )}

        {/* VIEW 3: Capability vs Pricing Quadrant */}
        {viewMode === 'quadrant' && (
          <ModelQuadrantChart
            selectedModels={selectedModels}
            allModels={AI_MODELS_DATA}
          />
        )}

        {/* VIEW 4: Technical Specs Table */}
        {viewMode === 'specs' && (
          <BenchmarkSpecsTable selectedModels={selectedModels} />
        )}
      </main>

      {/* ── 07. Interpretation & Evidence Guide (Compact 3-column layout) ── */}
      <section className="bench-guide-panel" aria-labelledby="bench-guide-title">
        <div className="guide-header-strip">
          <div className="guide-header-left">
            <BookOpen size={14} className="text-rose-400" />
            <h3 className="guide-headline" id="bench-guide-title">
              Responsible Benchmark Interpretation
            </h3>
          </div>
          <span className="guide-header-note">Evaluation Methodology &amp; Contamination Safeguards</span>
        </div>

        <div className="guide-cards-grid-compact">
          <div className="guide-card-compact">
            <span className="guide-card-index">01</span>
            <h4>Workload Specialization</h4>
            <p>
              Leading on coding evaluations (SWE-bench Pro, Terminal-Bench) does not imply superior creative writing or conversational nuance. Choose models tailored to your specific application workload.
            </p>
          </div>

          <div className="guide-card-compact">
            <span className="guide-card-index">02</span>
            <h4>Latency vs Compute Costs</h4>
            <p>
              Frontier reasoning models consume extended test-time compute. Compare the Artificial Analysis Intelligence Index against output price to find the best ROI for high-volume or interactive workloads.
            </p>
          </div>

          <div className="guide-card-compact">
            <span className="guide-card-index">03</span>
            <h4>Contamination &amp; Satiation</h4>
            <p>
              Legacy benchmarks (MATH Level 5, GSM8K, HumanEval, MMLU-Pro) have saturated or stopped being reported. This catalogue tracks the boards labs still publish: SWE-bench Pro, Terminal-Bench 4.0, FrontierMath v2, ARC-AGI-2, GPQA Diamond and HLE.
            </p>
          </div>
        </div>

        {/* Audit Status Bar */}
        <div className="bench-audit-bar">
          <div className="audit-left">
            <ShieldCheck size={14} className="text-rose-400 flex-shrink-0" />
            <span>
              All {AI_MODELS_DATA.length} frontier model benchmarks independently audited against published technical reports and LMSYS leaderboards.
            </span>
          </div>

          <CatalogueFreshness audit={freshness} />

          <a href="/api/benchmarks" target="_blank" rel="noreferrer" className="audit-api-btn">
            <span>Verified JSON Telemetry</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </section>

      {/* ── 08. Footer Back Link ── */}
      <div className="benchmarks-footer-nav">
        <Link href="/" className="story-back-link">
          <ArrowLeft size={15} />
          <span>Back to NeuBench Timeline</span>
        </Link>
      </div>
    </div>
  );
}
