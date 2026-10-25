"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  Bookmark,
  Building2,
  CalendarDays,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  ExternalLink,
  Flame,
  Info,
  Layers,
  MessageSquare,
  Orbit,
  Radio,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
  Send,
} from "lucide-react";
import Link from "next/link";
import { NeubenchLogo } from "@/components/neubench-logo";
import dynamic from "next/dynamic";
import "./benchmarks/benchmarks.css";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  PAGE_SIZE,
  filterTimelineStories,
  haystackOf,
  type StoryDisplay,
  type TimelineFacets,
} from "@/lib/timeline-shared";
import { useTheme } from "@/lib/theme";
import { useAuth, whenAuthSettled } from "@/lib/auth/store";
import {
  UpvoteButton,
  BookmarkButton,
  ShareButton,
  useBookmarks,
} from "@/components/story-actions";
import { performSemanticSearch } from "@/lib/semantic-search";
import { AccountButton } from "@/components/auth/account-button";
import {
  HeroLatestArt,
  HeroTrendingArt,
  HeroSavedArt,
  HeroAboutArt,
  HeroDigestArt,
  HeroFeedbackArt,
} from "@/components/hero-arts";
import {
  DailyDigestMainView,
  FeedbackConnectMainView,
  computeDailyDigest,
  type DailyDigestData,
} from "@/components/views-digest-feedback";

const ModelBenchmarksComparator = dynamic(
  () =>
    import("@/components/model-benchmarks-comparator").then(
      (mod) => mod.ModelBenchmarksComparator
    ),
  {
    ssr: false,
    loading: () => (
      <div className="bench-loading-shell" aria-live="polite">
        <span className="bench-loading-pulse" />
        Loading benchmark data…
      </div>
    ),
  }
);

interface ExploreClientProps {
  /** The first page of the merged timeline, rendered server-side. */
  initialStories: StoryDisplay[];
  /** Distinct years / months / companies over the full merge. */
  facets: TimelineFacets;
}

const redundancyCache = new Map<string, boolean>();
function normalizeForCompare(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * True when `b` is essentially a rephrasing/extension of `a` (e.g. "why it
 * matters" was composed from the summary's first sentence). Used to avoid
 * showing two near-duplicate blocks in the preview. Result is memoized because
 * the same summary→significance pair is compared on every render.
 */
function isRedundantWith(a: string, b: string): boolean {
  if (!a || !b) return false;
  const key = `${a.length}:${b.length}:${a}|${b}`;
  const cached = redundancyCache.get(key);
  if (cached !== undefined) return cached;
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  const redundant =
    nb.startsWith(na.slice(0, Math.min(60, na.length))) ||
    na.startsWith(nb.slice(0, Math.min(60, nb.length)));
  redundancyCache.set(key, redundant);
  return redundant;
}

/** Initials for a row whose story has no lead image: "Anthropic" → "AN",
 *  "Open AI" → "OA". Keeps the row grid stable instead of collapsing. */
function monogramOf(story: StoryDisplay): string {
  const label = (story.company || story.source || story.title).trim();
  const words = label.split(/[\s._/-]+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

/**
 * Produces a 2-4 line insightful preview summary for timeline cards.
 * Targets ~260-320 characters so each row gives a real sense of why the
 * story matters, not just a teaser headline.
 */
function toShortReadableSummary(raw?: string | null, maxLen = 500): string {
  if (!raw) return "";
  const cleaned = raw.replace(/\s+/g, " ").trim();

  // Split into sentences
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  const rawSentences: string[] = cleaned.match(sentenceRegex)?.map(s => s.trim()) ?? [];

  // Deduplicate: skip a sentence if its first 50 chars already appear in accumulated
  const unique: string[] = [];
  for (const s of rawSentences) {
    const key = s.slice(0, 50).toLowerCase();
    if (!unique.some(u => u.slice(0, 50).toLowerCase() === key)) {
      unique.push(s);
    }
  }

  // Accumulate sentences up to maxLen
  let accumulated = "";
  for (const sentence of unique) {
    const next = accumulated ? `${accumulated} ${sentence}` : sentence;
    if (next.length > maxLen) break;
    accumulated = next;
  }

  if (accumulated.length >= 40) return accumulated;

  // Fallback: word-boundary truncation
  if (cleaned.length <= maxLen) return cleaned;
  const sliced = cleaned.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(" ");
  return lastSpace > 40 ? `${sliced.slice(0, lastSpace).trim()}...` : `${sliced}...`;
}

/**
 * One timeline row. Memoized so that scroll-driven state changes (the active
 * node highlight) only re-render the rows whose props actually changed instead
 * of reconciling the whole list.
 */
const TimelineRow = memo(function TimelineRow({
  story,
  showYear,
  isLatest,
  isExpanded,
  isActive,
  onToggle,
  upvoteCount = 0,
  isUpvoted = false,
  onVoteChange,
  onBookmarkChange,
  trendingRank,
}: {
  story: StoryDisplay;
  showYear: boolean;
  isLatest: boolean;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: (id: string) => void;
  upvoteCount?: number;
  isUpvoted?: boolean;
  onVoteChange?: (slug: string, voted: boolean, newCount: number) => void;
  onBookmarkChange?: (slug: string, bookmarked: boolean) => void;
  trendingRank?: number;
}) {
  // Feed-derived items build "why it matters" from the summary's own first
  // sentence. Now that the full summary is shown as the OVERVIEW block above,
  // repeating that sentence under WHY IT MATTERS would just duplicate it — so
  // the why-it-matters block is only rendered when it says something the
  // Build a highly insightful 2-4 line preview: significance/why-it-matters first
  // (it explains *why* this news matters), then the summary fills in the *what*.
  const insightSource = story.whyItMatters || story.significance || story.summary || story.deck || '';
  const previewText = toShortReadableSummary(insightSource, 320);
  const whyText = story.whyItMatters || story.significance;
  const hasDistinctSignificance = whyText && !isRedundantWith(story.summary, whyText);
  const words = ((story.summary || "") + (story.deck || "")).split(/\s+/).filter(Boolean).length;
  const readTimeMinutes = Math.max(1, Math.ceil(words / 140));

  return (
    <article className={`timeline-item ${isExpanded ? "is-expanded" : ""}`}>
      {showYear && (
        <div className="year-divider">
          <span>{story.year}</span>
          <span className="year-rule" />
          {isLatest && <span className="year-latest">Latest</span>}
        </div>
      )}
      <div className="story-row">
        <div aria-label={`${story.month} ${story.day}, ${story.year}`} className={`timeline-node node-${story.color} ${isLatest ? "node-latest" : ""}`}>
          <span className="date-day">{story.day}</span>
          <span className="date-month">{story.month}</span>
          {isActive && <span className="timeline-node-runner" />}
        </div>
        <div className="story-content">
          <div className="story-meta-row">
            {typeof trendingRank === "number" && (
              <span className={`trending-rank-badge rank-${trendingRank <= 3 ? trendingRank : "other"}`}>
                <Flame size={11} className="fill-current" />
                <span>#{trendingRank} Trending</span>
              </span>
            )}
            <span className={`story-meta meta-${story.color}`}>
              <span className={`topic-dot dot-${story.color}`} />
              {story.topic}
            </span>
            {story.company && (
              <>
                <span className="story-meta-dot" aria-hidden="true">•</span>
                <span className="story-company-tag">
                  {story.company}
                </span>
              </>
            )}
            <span className="story-meta-dot" aria-hidden="true">•</span>
            <span className="story-read-time" title="Estimated reading time">
              {readTimeMinutes} min read
            </span>
          </div>
          <div className="story-title-line">
            <Link className="story-title story-title-link" href={`/story/${story.slug}`} prefetch={true} title="Read full story">
              <span className="story-title-text">{story.title}</span>
            </Link>
          </div>
          <p className="story-preview">{previewText}</p>
          <div className="story-actions-bar">
            <div className="story-action-group story-actions-left">
              <UpvoteButton
                slug={story.slug}
                initialCount={upvoteCount}
                initialVoted={isUpvoted}
                onVoteChange={onVoteChange}
              />
              <BookmarkButton
                slug={story.slug}
                onBookmarkChange={onBookmarkChange}
              />
              <ShareButton
                title={story.title}
                slug={story.slug}
                summary={previewText}
                topic={story.topic}
              />
            </div>
            <div className="story-action-group story-actions-right">
              <a href={`/story/${story.slug}`} className="read-link read-article-link" title="Read full story">
                <span>Read story</span>
                <ArrowRight size={12} className="read-link-icon" />
              </a>
              <a href={story.sourceUrl} className="read-link read-original-link" target="_blank" rel="noreferrer" title="Read original source">
                <span>Original source</span>
                <ExternalLink size={12} className="read-link-icon" />
              </a>
            </div>
          </div>
          <div className={`story-detail-wrap ${isExpanded ? "is-open" : ""}`} id={`story-detail-${story.id}`}>
            <div>
              <div className="detail-inner">
                {story.keyPoints && story.keyPoints.length > 0 ? (
                  <div className={`key-points key-points-${story.color}`}>
                    <span>Key Takeaways</span>
                    <ul>
                      {story.keyPoints.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {story.summary && (story.deck || !story.keyPoints || story.keyPoints.length === 0) ? (
                  <div className="story-overview">
                    <span className="story-overview-label">Overview</span>
                    <p className="story-summary">{story.summary}</p>
                  </div>
                ) : null}
                {hasDistinctSignificance ? (
                  <div className={`why-it-matters why-${story.color}`}>
                    <div className="why-it-matters-header">
                      <Sparkles aria-hidden="true" size={12} strokeWidth={2.2} />
                      <span>Why it matters</span>
                    </div>
                    <p>{whyText}</p>
                  </div>
                ) : null}
                <div className="story-expand-footer">
                  <Link
                    href={`/story/${story.slug}`}
                    className="full-story-link-btn"
                  >
                    <span>Read full story, stats &amp; breakdown</span>
                    <ArrowRight size={13} />
                  </Link>
                  <div className="story-expand-actions">
                    <a className="source-link" href={story.sourceUrl} rel="noreferrer" target="_blank">
                      <BookOpen size={13} /> Source: {story.source}
                      <ArrowUpRight size={12} />
                    </a>
                    <ShareButton
                      title={story.title}
                      slug={story.slug}
                      summary={previewText}
                      topic={story.topic}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {story.imageUrl ? (
          <a aria-hidden="true" className="story-thumb" href={`/story/${story.slug}`} tabIndex={-1}>
            {/* eslint-disable-next-line @next/next/no-img-element -- og:image hosts are arbitrary, so these bypass the image optimizer */}
            <img alt="" decoding="async" loading="lazy" referrerPolicy="no-referrer" src={story.imageUrl} />
          </a>
        ) : (
          <span aria-hidden="true" className={`story-thumb story-thumb-mono thumb-${story.color}`}>
            {monogramOf(story)}
          </span>
        )}
      </div>
    </article>
  );
});

/** Single-select company combobox. The panel is absolutely positioned flush
 *  against the trigger's bottom edge (`top: 100%`) so the list opens directly
 *  on the field, and flips upward when there isn't room below.
 *
 *  Implements the ARIA combobox/listbox pattern: focus stays on the trigger and
 *  the active option is pointed at with aria-activedescendant, so Arrow keys,
 *  Home/End, Enter/Space and Escape all work without moving DOM focus.
 */
function SidebarSelect({
  options,
  value,
  onChange,
  allLabel = "All",
  ariaLabel = "Filter",
  panelMinWidth = 0,
  panelMaxWidth = 0,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (selected: string) => void;
  allLabel?: string;
  ariaLabel?: string;
  panelMinWidth?: number;
  panelMaxWidth?: number;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'down' | 'up'>('down');
  const listboxId = useId();
  const allOptions = useMemo(() => [{ value: "all", label: allLabel }, ...options], [options, allLabel]);
  const selectedIndex = Math.max(0, allOptions.findIndex((o) => o.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [openSelection, setOpenSelection] = useState({ isOpen, selectedIndex });

  if (isOpen !== openSelection.isOpen || (isOpen && selectedIndex !== openSelection.selectedIndex)) {
    setOpenSelection({ isOpen, selectedIndex });
    if (isOpen) setActiveIndex(selectedIndex);
  }

  useEffect(() => {
    if (!isOpen || !panelRef.current || !triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom - 10;
    const spaceAbove = triggerRect.top - 10;
    setPosition(spaceBelow < panelRect.height && spaceAbove > spaceBelow ? 'up' : 'down');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const active = panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[activeIndex];
    active?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, activeIndex]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [isOpen]);

  const choose = (option: string) => {
    onChange(option);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key;

    if (key === 'Escape') {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
      return;
    }

    if (key === 'Tab') {
      if (isOpen) setIsOpen(false);
      return;
    }

    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(selectedIndex);
        return;
      }
      if (key === 'Home') setActiveIndex(0);
      else if (key === 'End') setActiveIndex(allOptions.length - 1);
      else if (key === 'ArrowUp') {
        setActiveIndex((prev) => (prev <= 0 ? allOptions.length - 1 : prev - 1));
      } else {
        setActiveIndex((prev) => (prev >= allOptions.length - 1 ? 0 : prev + 1));
      }
      return;
    }

    if ((key === 'Enter' || key === ' ') && isOpen) {
      event.preventDefault();
      choose(allOptions[activeIndex].value);
    }
  };

  return (
    <div className="company-select">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        className="company-select-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
      >
        <span className="company-select-trigger-label">
          {allOptions.find((o) => o.value === value)?.label ?? allLabel}
        </span>
        <ChevronDown size={13} strokeWidth={2} />
      </button>
      {isOpen && (
        <ul
          ref={panelRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`company-select-panel ${position === 'up' ? 'panel-open-up' : ''}`}
          style={{ minWidth: panelMinWidth || undefined, maxWidth: panelMaxWidth || undefined }}
        >
          {allOptions.map((option, index) => (
            <li
              key={option.value}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={value === option.value}
              data-active={index === activeIndex}
              className={`company-select-option ${value === option.value ? 'is-selected' : ''}`}
              onClick={() => choose(option.value)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterFields({
  facets,
  idPrefix,
  year,
  month,
  company,
  topic,
  onYearChange,
  onMonthChange,
  onCompanyChange,
  onTopicChange,
}: {
  facets: TimelineFacets;
  idPrefix: string;
  year: string;
  month: string;
  company: string;
  topic?: string;
  onYearChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onCompanyChange: (value: string) => void;
  onTopicChange?: (value: string) => void;
}) {
  const categoryOptions = [
    { value: "all", label: "All categories" },
    { value: "Models", label: "Models" },
    { value: "Products", label: "Products" },
    { value: "Research", label: "Research" },
    { value: "Policy", label: "Policy" },
  ];

  return (
    <div className="filter-popover-body">
      {topic !== undefined && (
        <div className="filter-popover-field">
          <label className="filter-popover-label" htmlFor={`${idPrefix}-filter-topic`}>
            Category
          </label>
          <select
            id={`${idPrefix}-filter-topic`}
            className="filter-popover-select"
            value={topic}
            onChange={(event) => onTopicChange?.(event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="filter-popover-field">
        <label className="filter-popover-label" htmlFor={`${idPrefix}-filter-year`}>
          Period (Year)
        </label>
        <select
          id={`${idPrefix}-filter-year`}
          className="filter-popover-select"
          value={year}
          onChange={(event) => onYearChange(event.target.value)}
        >
          <option value="all">All years</option>
          {facets.years.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-popover-field">
        <label className="filter-popover-label" htmlFor={`${idPrefix}-filter-month`}>
          Month
        </label>
        <select
          id={`${idPrefix}-filter-month`}
          className="filter-popover-select"
          value={month}
          onChange={(event) => onMonthChange(event.target.value)}
        >
          <option value="all">All months</option>
          {facets.months.map(({ value: monthValue, label }) => (
            <option key={monthValue} value={monthValue}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-popover-field">
        <span className="filter-popover-label">Company / Lab</span>
        <SidebarSelect options={facets.companies.map((c) => ({ value: c, label: c }))} value={company} onChange={onCompanyChange} allLabel="All companies" ariaLabel="Filter by company" panelMinWidth={200} />
      </div>
    </div>
  );
}

type FeedMode = "latest" | "digest" | "trending" | "saved" | "feedback" | "about" | "benchmarks";

// Scores are relative to the newest story rather than the wall clock, so the
// server HTML and the hydrating client agree on the ranking.
function getTrendingReferenceTime(stories: StoryDisplay[]): number {
  let latest = 0;
  for (const story of stories) {
    const time = new Date(story.date).getTime();
    if (Number.isFinite(time) && time > latest) latest = time;
  }
  return latest;
}

function getTrendingScore(story: StoryDisplay, upvotes: number, referenceTime: number): number {
  const publishedDate = new Date(story.date).getTime();
  const hoursAgo = Math.max(1, (referenceTime - publishedDate) / (1000 * 60 * 60));
  const basePoints = (upvotes || 0) * 10 + 1;
  return basePoints / Math.pow(hoursAgo / 24 + 1, 1.25);
}

function AboutBriefingView({
  onBrowseLatest,
  onBrowseTrending,
}: {
  onBrowseLatest: () => void;
  onBrowseTrending: () => void;
}) {
  const [tipUrl, setTipUrl] = useState("");
  const [tipTitle, setTipTitle] = useState("");
  const [tipTopic, setTipTopic] = useState("Models");
  const [tipNote, setTipNote] = useState("");
  const [tipSubmitted, setTipSubmitted] = useState(false);

  const handleTipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipUrl && !tipTitle && !tipNote) return;
    setTipSubmitted(true);
  };

  return (
    <div className="about-detailed-dossier" aria-label="About NeuBench System Dossier">
      {/* 1. At a Glance Stats Grid */}
      <section className="about-stats-grid" aria-label="NeuBench at a glance">
        <div className="about-stat-card">
          <div className="about-stat-value">4 Pillars</div>
          <div className="about-stat-label">Systematic taxonomy</div>
          <div className="about-stat-desc">
            Models, Products, Research, and Policy covering the full spectrum.
          </div>
        </div>
        <div className="about-stat-card">
          <div className="about-stat-value">20+ Feeds</div>
          <div className="about-stat-label">Primary sources</div>
          <div className="about-stat-desc">
            Continuous ingestion directly from OpenAI, DeepMind, Anthropic, Meta, and arXiv.
          </div>
        </div>
        <div className="about-stat-card">
          <div className="about-stat-value">4+ Years</div>
          <div className="about-stat-label">Historical depth</div>
          <div className="about-stat-desc">
            From early foundation models to unified multi-modal reasoning agents.
          </div>
        </div>
        <div className="about-stat-card">
          <div className="about-stat-value">100% Sourced</div>
          <div className="about-stat-label">Zero hallucinations</div>
          <div className="about-stat-desc">
            Every moment links directly to verified whitepapers and official releases.
          </div>
        </div>
      </section>

      {/* 2. The Four Pillars of Intelligence */}
      <section className="about-dossier-section">
        <div className="section-head">
          <div className="section-badge">Taxonomy</div>
          <h3 className="section-title">The Four Pillars of the AI Landscape</h3>
          <p className="section-subtitle">
            Every story across NeuBench is classified into one of four core tracks to ensure balanced, multi-dimensional intelligence:
          </p>
        </div>

        <div className="about-pillars-grid">
          <div className="about-pillar-card pillar-models">
            <div className="pillar-header">
              <div className="pillar-icon">
                <Cpu size={20} />
              </div>
              <h4>Models &amp; Weights</h4>
            </div>
            <p>
              Frontier foundation models, multimodal vision-language architectures, reasoning leaps (such as test-time compute scaling and chain-of-thought verification), open-weight releases, parameter-efficient fine-tuning, and context window expansions.
            </p>
            <div className="pillar-tags">
              <span>Reasoning</span>
              <span>Multimodal</span>
              <span>Open Weights</span>
              <span>Inference Efficiency</span>
            </div>
          </div>

          <div className="about-pillar-card pillar-products">
            <div className="pillar-header">
              <div className="pillar-icon">
                <Layers size={20} />
              </div>
              <h4>Products &amp; Harnesses</h4>
            </div>
            <p>
              Real-world implementations bringing frontier intelligence into practice: autonomous coding agents, developer toolchains, enterprise platforms, multimodal creative workflows, AI search engines, and physical robotics integrations.
            </p>
            <div className="pillar-tags">
              <span>Agentic Systems</span>
              <span>Dev Tools</span>
              <span>Code Generation</span>
              <span>Enterprise AI</span>
            </div>
          </div>

          <div className="about-pillar-card pillar-research">
            <div className="pillar-header">
              <div className="pillar-icon">
                <Sparkles size={20} />
              </div>
              <h4>Foundational Research</h4>
            </div>
            <p>
              Peer-reviewed papers and ArXiv pre-prints unveiling breakthrough mechanisms: reinforcement learning from verifiable rewards (RLVR), mechanistic interpretability, synthetic data generation, architectural modifications, and alignment science.
            </p>
            <div className="pillar-tags">
              <span>ArXiv cs.AI</span>
              <span>RLHF / RLVR</span>
              <span>Mechanistic Interpretability</span>
              <span>Scaling Laws</span>
            </div>
          </div>

          <div className="about-pillar-card pillar-policy">
            <div className="pillar-header">
              <div className="pillar-icon">
                <BookOpen size={20} />
              </div>
              <h4>Policy &amp; Governance</h4>
            </div>
            <p>
              The structural frameworks governing frontier development: international safety treaties, national executive orders, semiconductor export controls, copyright &amp; intellectual property precedent, and standardized benchmark evaluations.
            </p>
            <div className="pillar-tags">
              <span>Governance</span>
              <span>Safety Standards</span>
              <span>Export Controls</span>
              <span>Copyright &amp; IP</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Ingestion Pipeline & Architecture */}
      <section className="about-dossier-section">
        <div className="section-head">
          <div className="section-badge">Architecture</div>
          <h3 className="section-title">Automated Telemetry Pipeline</h3>
          <p className="section-subtitle">
            How NeuBench discovers, parses, correlates, and catalogs breaking moments around the clock:
          </p>
        </div>

        <div className="pipeline-steps-grid">
          <div className="pipeline-step-card">
            <div className="pipeline-step-num">01</div>
            <h5>24/7 Radar Crawl</h5>
            <p>
              Automated ingestion engines listen to ArXiv pre-prints, GitHub releases, frontier lab technical blogs (OpenAI, Anthropic, DeepMind, Meta, Mistral, xAI), and regulatory dockets.
            </p>
          </div>

          <div className="pipeline-step-card">
            <div className="pipeline-step-num">02</div>
            <h5>Entity &amp; Delta Extraction</h5>
            <p>
              Each release is automatically decomposed into benchmark comparisons, architecture changes, parameter counts, and primary citations, filtering away promotional marketing copy.
            </p>
          </div>

          <div className="pipeline-step-card">
            <div className="pipeline-step-num">03</div>
            <h5>Deduplication &amp; Grouping</h5>
            <p>
              When multiple outlets cover a single announcement, NeuBench groups them into one authoritative moment anchored directly to the primary paper, model weights, or official post.
            </p>
          </div>

          <div className="pipeline-step-card">
            <div className="pipeline-step-num">04</div>
            <h5>Community Velocity Index</h5>
            <p>
              Reader upvotes, discussions, and saves dynamically feed our velocity ranking algorithm, ensuring pivotal breakthroughs elevate naturally on the Trending radar.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Provenance & Editorial Transparency */}
      <section className="about-dossier-section">
        <div className="about-provenance-box">
          <div className="provenance-title-row">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <h4>Our Editorial Commitments</h4>
          </div>
          <div className="provenance-bullets">
            <div className="provenance-bullet-item">
              <strong>100% Primary Source Attribution:</strong> Every story includes direct links to official arXiv papers, code repositories, or lab releases. No unsourced rumors or speculation.
            </div>
            <div className="provenance-bullet-item">
              <strong>Zero Paid Inclusions:</strong> NeuBench has no sponsored stories, promoted rankings, or paid editorial placements. All stories are tracked strictly based on technical merit and impact.
            </div>
            <div className="provenance-bullet-item">
              <strong>Neutral Technical Focus:</strong> We prioritize reproducible benchmarks, released weights, and verifiable architecture improvements rather than vanity PR metrics.
            </div>
          </div>
        </div>
      </section>

      {/* 5. Community Tip Submission */}
      <section className="about-dossier-section">
        <div className="about-tip-box">
          <div className="tip-box-header">
            <Radio size={20} className="text-violet-400" />
            <div>
              <h4>Submit a Milestone to the NeuBench Radar</h4>
              <p>Have you authored a breakthrough paper, released open weights, or spotted a pivotal shift? Submit it directly to our curation queue.</p>
            </div>
          </div>

          {tipSubmitted ? (
            <div className="tip-success-banner">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span>Thank you! Your dispatch has been submitted to the NeuBench radar queue for review.</span>
            </div>
          ) : (
            <form onSubmit={handleTipSubmit} className="tip-form-grid">
              <div className="tip-input-group">
                <label htmlFor="tip-url">Primary URL (arXiv, GitHub, Lab Blog)</label>
                <input
                  id="tip-url"
                  placeholder="https://arxiv.org/abs/... or https://github.com/..."
                  value={tipUrl}
                  onChange={(e) => setTipUrl(e.target.value)}
                  required
                />
              </div>

              <div className="tip-input-group">
                <label htmlFor="tip-title">Story / Model Title</label>
                <input
                  id="tip-title"
                  placeholder="e.g. DeepSeek-R1 Architecture Paper"
                  value={tipTitle}
                  onChange={(e) => setTipTitle(e.target.value)}
                  required
                />
              </div>

              <div className="tip-input-group">
                <label htmlFor="tip-topic">Category</label>
                <select
                  id="tip-topic"
                  value={tipTopic}
                  onChange={(e) => setTipTopic(e.target.value)}
                >
                  <option value="Models">Models</option>
                  <option value="Products">Products</option>
                  <option value="Research">Research</option>
                  <option value="Policy">Policy</option>
                </select>
              </div>

              <div className="tip-input-group full-width">
                <label htmlFor="tip-note">Technical Summary / Why it matters (optional)</label>
                <textarea
                  id="tip-note"
                  rows={2}
                  placeholder="Briefly describe key architecture deltas, benchmark gains, or significance..."
                  value={tipNote}
                  onChange={(e) => setTipNote(e.target.value)}
                />
              </div>

              <div className="tip-form-foot full-width">
                <button type="submit" className="hero-action-btn btn-primary">
                  <Send size={13} />
                  <span>Dispatch NeuBench Tip</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* 6. Quick FAQ */}
      <section className="about-dossier-section">
        <div className="section-head">
          <div className="section-badge">FAQ</div>
          <h3 className="section-title">Frequently Asked Questions</h3>
        </div>

        <div className="about-faq-grid">
          <div className="faq-card">
            <h5>How often does NeuBench update?</h5>
            <p>NeuBench runs continuous automated ingest pipelines that crawl major pre-print archives, code repositories, and lab blogs hourly. Trending velocity scores update in real-time as readers interact.</p>
          </div>
          <div className="faq-card">
              <h5>Do I need an account to upvote or bookmark?</h5>
              <p>Every story is free to read as a guest. An account is needed to vote and save, so your votes and saved stories follow you across devices.</p>
          </div>
          <div className="faq-card">
            <h5>How does the Trending velocity formula work?</h5>
            <p>Stories earn points from upvotes and bookmark saves, divided by a non-linear time decay function. This surfaces breaking high-velocity shifts without burying recent breakthroughs.</p>
          </div>
          <div className="faq-card">
            <h5>Can I export or share my saved dossier?</h5>
            <p>Yes. Stories in your Saved collection can be easily shared using the share button on each card, or browsed in a dedicated focused view.</p>
          </div>
        </div>
      </section>

      {/* 7. Footer Return Navigation */}
      <div className="dossier-footer-nav">
        <button type="button" className="hero-action-btn btn-primary" onClick={onBrowseLatest}>
          <Sparkles size={14} />
          <span>Browse Live Stream</span>
        </button>
        <button type="button" className="hero-action-btn" onClick={onBrowseTrending}>
          <Flame size={14} className="text-amber-400" />
          <span>Explore Trending Radar</span>
        </button>
      </div>
    </div>
  );
}

function useNarrowLayout() {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1080px)");
    const update = () => setIsNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isNarrow;
}

export function ExploreClient({
  initialStories,
  facets,
}: ExploreClientProps) {
  const [allStories, setAllStories] = useState<StoryDisplay[]>(initialStories);
  const [activeTopic, setActiveTopic] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeYear, setActiveYear] = useState<string>("all");
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const [activeCompany, setActiveCompany] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const isNarrowLayout = useNarrowLayout();
  const [isLight, toggleTheme] = useTheme();
  const [feedMode, setFeedMode] = useState<FeedMode>("latest");
  const [upvoteCounts, setUpvoteCounts] = useState<Record<string, number>>({});
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [bookmarks, , replaceBookmarks] = useBookmarks();
  // The identity votes are recorded against: the account when signed in, the
  // local guest token otherwise.
  const { clientId: authClientId, user: authUser, openAuth } = useAuth();

  // The server renders one page so the document stays small and the first
  // paint is quick. The rest of the merge streams in afterwards, so filtering
  // and scrolling still cover every story.
  useEffect(() => {
    let cancelled = false;

    const loadRest = async () => {
      let offset = initialStories.length;
      for (;;) {
        const res = await fetch(`/api/stories?offset=${offset}&limit=200`);
        if (!res.ok) return;
        const page = (await res.json()) as {
          stories?: StoryDisplay[];
          hasMore?: boolean;
        };
        const batch = page.stories ?? [];
        if (!batch.length) return;
        if (cancelled) return;
        setAllStories((prev) => {
          const seen = new Set(prev.map((story) => story.slug));
          const fresh = batch.filter((story) => !seen.has(story.slug));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        offset += batch.length;
        if (!page.hasMore) return;
      }
    };

    void loadRest();
    return () => {
      cancelled = true;
    };
  }, [initialStories.length]);

  // Actual valid saved stories present in allStories
  const validSavedStories = useMemo(() => {
    return allStories.filter((story) => bookmarks.has(story.slug));
  }, [allStories, bookmarks]);

  const savedCount = validSavedStories.length;

  // Prune any stale bookmark slugs that no longer exist in allStories
  useEffect(() => {
    if (!allStories.length || !bookmarks.size) return;
    const validSlugs = new Set(allStories.map((s) => s.slug));
    let hasStale = false;
    const cleaned = new Set<string>();
    bookmarks.forEach((slug) => {
      if (validSlugs.has(slug)) {
        cleaned.add(slug);
      } else {
        hasStale = true;
      }
    });
    if (hasStale) {
      replaceBookmarks(cleaned);
    }
  }, [allStories, bookmarks, replaceBookmarks]);

  // Draft filter state for uncommitted adjustments (only committed upon "Apply")
  const [draftYear, setDraftYear] = useState<string>(activeYear);
  const [draftMonth, setDraftMonth] = useState<string>(activeMonth);
  const [draftCompany, setDraftCompany] = useState<string>(activeCompany);
  const [draftTopic, setDraftTopic] = useState<string>(activeTopic);

  const filterWrapperRef = useRef<HTMLDivElement | null>(null);
  const headerFilterBtnRef = useRef<HTMLButtonElement | null>(null);
  const mobileFilterBtnRef = useRef<HTMLButtonElement | null>(null);
  const mobileSheetRef = useRef<HTMLDivElement | null>(null);

  const closeMobileFilter = useCallback(() => {
    setIsMobileFilterOpen(false);
    requestAnimationFrame(() => mobileFilterBtnRef.current?.focus());
  }, []);

  const syncDrafts = () => {
    setDraftYear(activeYear);
    setDraftMonth(activeMonth);
    setDraftCompany(activeCompany);
    setDraftTopic(activeTopic);
  };

  const handleToggleFilter = () => {
    setIsFilterOpen((prev) => {
      const willOpen = !prev;
      if (willOpen) syncDrafts();
      return willOpen;
    });
  };

  const handleOpenMobileFilter = () => {
    syncDrafts();
    setIsMobileFilterOpen(true);
  };

  const handleApplyFilter = () => {
    setActiveYear(draftYear);
    setActiveMonth(draftMonth);
    setActiveCompany(draftCompany);
    setActiveTopic(draftTopic);
    setActiveTimelineIndex(0);
    if (isMobileFilterOpen) {
      closeMobileFilter();
    } else if (isFilterOpen) {
      setIsFilterOpen(false);
      requestAnimationFrame(() => headerFilterBtnRef.current?.focus());
    }
  };

  const handleResetFilter = () => {
    setDraftYear("all");
    setDraftMonth("all");
    setDraftCompany("all");
    setDraftTopic("all");
  };

  const handleCloseFilter = () => {
    setIsFilterOpen(false);
    requestAnimationFrame(() => headerFilterBtnRef.current?.focus());
  };

  // Bottom sheet: focus the close button on open, keep Tab inside the sheet,
  // and close on Escape without disturbing the page's scroll position.
  useEffect(() => {
    if (!isMobileFilterOpen) return;
    mobileSheetRef.current?.querySelector<HTMLElement>(".filter-popover-close")?.focus();
  }, [isMobileFilterOpen]);

  const handleSheetKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMobileFilter();
      return;
    }
    if (event.key !== "Tab") return;

    const focusables = Array.from(
      mobileSheetRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], select, input, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute("disabled"));
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterWrapperRef.current && !filterWrapperRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  // Mobile/tablet header: the search field is collapsed to an icon and expands
  // in place when tapped.
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isMobileSearchOpen) searchInputRef.current?.focus();
  }, [isMobileSearchOpen]);

  // Load upvotes on mount, and again whenever the identity changes: a
  // signed-in reader's votes are their own, not the guest token's.
  useEffect(() => {
    if (!authClientId) return;

    let cancelled = false;
    const load = async () => {
      // A sign-in is still transferring the guest's votes; reading first
      // would mark them all as not voted.
      await whenAuthSettled();
      if (cancelled) return;
      const res = await fetch(`/api/upvotes?clientId=${encodeURIComponent(authClientId)}`);
      const data = await res.json();
      if (cancelled) return;
      if (data.counts && typeof data.counts === "object") {
        setUpvoteCounts(data.counts);
      }
      if (Array.isArray(data.userVotes)) {
        setUserVotes(new Set(data.userVotes));
      }
    };

    load().catch((err) => console.error("Failed to load upvotes:", err));

    return () => {
      cancelled = true;
    };
  }, [authClientId]);

  const handleVoteChange = useCallback((slug: string, voted: boolean, newCount: number) => {
    setUpvoteCounts((prev) => ({ ...prev, [slug]: newCount }));
    setUserVotes((prev) => {
      const next = new Set(prev);
      if (voted) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }, []);

  // ── Client-side filtering & Semantic AI Search ──────────
  const trendingReferenceTime = useMemo(() => getTrendingReferenceTime(allStories), [allStories]);

  const { filtered, semanticConcepts } = useMemo(() => {
    let result = (feedMode === "saved")
      ? validSavedStories
      : filterTimelineStories(allStories, {
          topic: activeTopic,
          year: activeYear,
          month: activeMonth,
          company: activeCompany,
          q: "",
        });

    if (feedMode === "saved") {
      if (activeTopic !== "all") {
        result = result.filter((s) => s.topic === activeTopic);
      }
      if (activeYear !== "all") {
        result = result.filter((s) => s.year === activeYear);
      }
      if (activeMonth !== "all") {
        result = result.filter((s) => s.month === activeMonth);
      }
      if (activeCompany !== "all") {
        result = result.filter((s) => s.company?.toLowerCase() === activeCompany.toLowerCase());
      }
    }

    const q = search.trim();
    let matchedConcepts: string[] = [];

    if (q) {
      const semanticResults = performSemanticSearch(result, q);
      if (semanticResults.length > 0) {
        result = semanticResults.map((r) => r.story);
        const conceptSet = new Set<string>();
        for (const r of semanticResults.slice(0, 10)) {
          for (const c of r.matchedConcepts) conceptSet.add(c);
        }
        matchedConcepts = Array.from(conceptSet);
      } else {
        result = result.filter((story) => haystackOf(story).includes(q.toLowerCase()));
      }
    } else if (feedMode === "trending") {
      result = [...result].sort((a, b) => {
        const scoreA = getTrendingScore(a, upvoteCounts[a.slug] || 0, trendingReferenceTime);
        const scoreB = getTrendingScore(b, upvoteCounts[b.slug] || 0, trendingReferenceTime);
        return scoreB - scoreA;
      });
    }

    return { filtered: result, semanticConcepts: matchedConcepts };
  }, [allStories, activeTopic, activeYear, activeMonth, activeCompany, search, feedMode, upvoteCounts, validSavedStories, trendingReferenceTime]);

  // Compute top trending stories map (slug -> rank) so trending indicators can be shown on any view
  const topTrendingSlugs = useMemo(() => {
    const sorted = [...allStories]
      .sort((a, b) => {
        const scoreA = getTrendingScore(a, upvoteCounts[a.slug] || 0, trendingReferenceTime);
        const scoreB = getTrendingScore(b, upvoteCounts[b.slug] || 0, trendingReferenceTime);
        return scoreB - scoreA;
      })
      .slice(0, 10);
    const map = new Map<string, number>();
    sorted.forEach((story, idx) => map.set(story.slug, idx + 1));
    return map;
  }, [allStories, upvoteCounts, trendingReferenceTime]);

  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);
  const timelineRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Progressive rendering: show PAGE_SIZE rows at a time, expand on scroll.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset the visible window on every filter change (skip the initial mount
  // where the defaults are already correct).
  const skipInitialReset = useRef(true);
  useEffect(() => {
    if (skipInitialReset.current) {
      skipInitialReset.current = false;
      return;
    }
    setVisibleCount(PAGE_SIZE);
    setActiveTimelineIndex(0);
  }, [activeTopic, activeYear, activeMonth, activeCompany, search, feedMode]);

  const stories = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;


  // Pre-calculate story counts for each category. The server ships the exact
  // totals with the first page; counting the rows the client has streamed in
  // so far would show a different number for every category until the last
  // page landed, so the local count is only a fallback.
  const topicCounts = useMemo(() => {
    if (facets.topicCounts) return facets.topicCounts;
    const counts: Record<string, number> = { all: allStories.length };
    for (const story of allStories) {
      counts[story.topic] = (counts[story.topic] || 0) + 1;
    }
    return counts;
  }, [allStories, facets.topicCounts]);

  const digestData = useMemo(() => {
    return computeDailyDigest(allStories);
  }, [allStories]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isFilterOpen) {
          setIsFilterOpen(false);
          headerFilterBtnRef.current?.focus();
        }
        if (isMobileFilterOpen) closeMobileFilter();
        if (isMobileSearchOpen) setIsMobileSearchOpen(false);
      } else if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((document.activeElement?.tagName || "").toUpperCase())
      ) {
        event.preventDefault();
        setIsMobileSearchOpen(true);
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFilterOpen, isMobileFilterOpen, isMobileSearchOpen, closeMobileFilter]);

  useEffect(() => {
    const handleScroll = () => {
      if (!timelineRef.current) return;
      const timeline = timelineRef.current;

      // Calculate progress based on scroll position
      const scrollTop = timeline.scrollTop || (timeline.parentElement?.scrollTop || 0);
      const scrollHeight = timeline.scrollHeight - timeline.clientHeight;
      if (scrollHeight <= 0) return;

      const progress = Math.max(0, Math.min(1, scrollTop / scrollHeight));
      const newIndex = Math.round(progress * Math.max(stories.length - 1, 0));

      // Only update on significant index changes to prevent render thrashing
      if (newIndex !== activeTimelineIndex) {
        setActiveTimelineIndex(newIndex);
      }
    };

    const throttleTimer = setInterval(handleScroll, 50);
    return () => clearInterval(throttleTimer);
  }, [activeTimelineIndex, stories.length]);

  // Infinite scroll: bump the visible count when the sentinel enters view.
  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore]);


  const hasActiveFilters =
    activeTopic !== "all" || activeYear !== "all" || activeMonth !== "all" || search.trim() !== "" || activeCompany !== "all";

  const clearFilters = () => {
    setSearch("");
    setActiveTopic("all");
    setActiveYear("all");
    setActiveMonth("all");
    setActiveCompany("all");
    setDraftYear("all");
    setDraftMonth("all");
    setDraftCompany("all");
    setActiveTimelineIndex(0);
  };

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);


  const showEmpty = stories.length === 0;

  // One removable chip per applied filter, so the sidebar shows what is
  // narrowing the timeline without opening every control.
  const monthLabel = facets.months.find((month) => month.value === activeMonth)?.label ?? activeMonth;
  const activeFilterChips = [
    activeTopic !== "all" && {
      key: "topic",
      name: "category",
      label: activeTopic,
      clear: () => setActiveTopic("all"),
    },
    activeYear !== "all" && {
      key: "year",
      name: "year",
      label: activeYear,
      clear: () => setActiveYear("all"),
    },
    activeMonth !== "all" && {
      key: "month",
      name: "month",
      label: monthLabel,
      clear: () => setActiveMonth("all"),
    },
    activeCompany !== "all" && {
      key: "company",
      name: "company",
      label: activeCompany,
      clear: () => setActiveCompany("all"),
    },
    search.trim() !== "" && {
      key: "search",
      name: "search",
      label: `"${search.trim()}"`,
      clear: () => setSearch(""),
    },
  ].filter((chip): chip is { key: string; name: string; label: string; clear: () => void } => Boolean(chip));

  // The server ships the exact corpus size and per-topic totals with the first
  // page. Until the rest of the corpus streams in, `filtered.length` is only a
  // partial count, so prefer the authoritative number whenever the active
  // filters are ones the server already counted. Saved and free-text search
  // are inherently client-side, so those keep the local count.
  const hasNarrowFilter =
    activeYear !== "all" ||
    activeMonth !== "all" ||
    activeCompany !== "all" ||
    search.trim() !== "";
  const authoritativeCount =
    feedMode === "saved" || hasNarrowFilter
      ? null
      : activeTopic === "all"
        ? (facets.total ?? null)
        : (facets.topicCounts?.[activeTopic] ?? null);
  const shownCount = authoritativeCount ?? filtered.length;
  const resultCountLabel = `${shownCount} ${shownCount === 1 ? "story" : "stories"}`;

  return (
    <main className={`site-frame archive-page mode-${feedMode}`} data-feed-mode={feedMode}>
      <a className="skip-to-stories" href="#timeline">
        Skip to stories
      </a>
      <header className={`archive-topbar ${isMobileSearchOpen ? "is-mobile-search-open" : ""}`}>
        <div className="header-brand-group">
          <Link className="wordmark" href="/" aria-label="NEUBENCH, home">
            <NeubenchLogo size={22} />
          </Link>
          
        </div>

        <label className="header-search">
          <Search aria-hidden="true" size={15} />
          <input
            aria-label="Search companies, models or stories"
            onChange={(event) => {
              setSearch(event.target.value);
              setActiveTimelineIndex(0);
            }}
            placeholder="Search companies, models or stories..."
            ref={searchInputRef}
            value={search}
          />
          {search ? (
            <button
              aria-label="Clear search"
              className="clear-search"
              onClick={() => {
                setSearch("");
                setActiveTimelineIndex(0);
                searchInputRef.current?.focus();
              }}
              type="button"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="header-search-kbd" title="Press / to search">
              /
            </kbd>
          )}
          {/* Mobile/tablet only: collapses the expanded search. */}
          <button
            aria-label="Close search"
            className="header-search-close"
            onClick={() => setIsMobileSearchOpen(false)}
            type="button"
          >
            <X size={16} />
          </button>
        </label>

        <div className="header-actions">
          {/* Header Filter Button & Anchored Dropdown Popover */}
          <div className="header-filter-wrapper" ref={filterWrapperRef} data-tour-target="filter">
            <button
              ref={headerFilterBtnRef}
              aria-controls="header-filter-popover"
              aria-expanded={isFilterOpen}
              className={`header-filter-toggle-btn ${isFilterOpen ? "is-open" : ""}`}
              onClick={handleToggleFilter}
              title={isFilterOpen ? "Close filter panel" : "Open filter panel"}
              type="button"
            >
              <SlidersHorizontal size={14} />
              <span className="filter-btn-text">Filter</span>
              {activeFilterChips.length > 0 && (
                <span className="header-filter-badge">{activeFilterChips.length}</span>
              )}
              <ChevronDown
                size={13}
                className={`header-filter-chevron ${isFilterOpen ? "turned" : ""}`}
              />
            </button>

            {/* Anchored Filter Dropdown below filter button (desktop only —
                narrow screens use the bottom sheet driven by the fixed pill). */}
            {isFilterOpen && !isNarrowLayout && (
              <div
                aria-label="Filter"
                className="header-filter-popover"
                id="header-filter-popover"
              >
                <div className="filter-popover-head">
                  <div className="filter-popover-title">
                    <SlidersHorizontal size={13} className="text-violet-400" />
                    <span>Filter Moments</span>
                  </div>
                  <button
                    aria-label="Close filter"
                    className="filter-popover-close"
                    onClick={handleCloseFilter}
                    type="button"
                  >
                    <X size={13} />
                  </button>
                </div>

                <FilterFields
                  facets={facets}
                  idPrefix="popover"
                  year={draftYear}
                  month={draftMonth}
                  company={draftCompany}
                  onYearChange={setDraftYear}
                  onMonthChange={setDraftMonth}
                  onCompanyChange={setDraftCompany}
                />

                {/* Footer Buttons */}
                <div className="filter-popover-foot">
                  <button
                    type="button"
                    className="filter-popover-btn-reset"
                    onClick={handleResetFilter}
                  >
                    <RotateCcw size={11} />
                    <span>Reset</span>
                  </button>

                  <button
                    type="button"
                    className="filter-popover-btn-apply"
                    onClick={handleApplyFilter}
                  >
                    <Check size={12} strokeWidth={2.4} />
                    <span>Apply</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile/tablet only: the search field is hidden behind this icon. */}
          <button
            aria-expanded={isMobileSearchOpen}
            aria-label="Open search"
            className="header-icon-button header-search-toggle"
            onClick={() => setIsMobileSearchOpen(true)}
            type="button"
          >
            <Search size={18} />
          </button>

          <button
            aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
            aria-pressed={isLight}
            className="header-icon-button header-theme-toggle"
            onClick={toggleTheme}
            title={isLight ? "Dark theme" : "Light theme"}
            type="button"
          >
            <Sun size={17} />
          </button>

          {/* Account affordance: shows a user icon (not email) when signed in. */}
          <AccountButton />
        </div>
      </header>

      <div className="archive-shell">
        <div className="archive-layout">
          {/* Left Sidebar Navigation */}
          <aside aria-label="Primary Navigation" className="archive-sidebar">
            <div className="sidebar-sticky-wrapper">
              {/* Group 1: Discover */}
              <div className="sidebar-nav-group">
                <div className="sidebar-section-title">FEEDS</div>
                <nav className="sidebar-nav" aria-label="Feeds">
                  {/* 1. Latest */}
                  <button
                    type="button"
                    className={`sidebar-nav-item item-latest ${feedMode === "latest" && activeTopic === "all" ? "is-active" : ""}`} data-label="Latest"
                    onClick={() => {
                      setFeedMode("latest");
                      setActiveTopic("all");
                      setActiveTimelineIndex(0);
                    }}
                  >
                    <div className="sidebar-nav-icon">
                      <Sparkles size={16} />
                    </div>
                    <div className="sidebar-nav-info">
                      <span className="sidebar-nav-label">Latest</span>
                    </div>
                    {feedMode === "latest" && activeTopic === "all" && <span className="nav-live-dot" />}
                  </button>

                  {/* 2. Daily Digest */}
                  <button
                    type="button"
                    className={`sidebar-nav-item item-digest ${feedMode === "digest" ? "is-active" : ""}`} data-label="Daily Digest"
                    onClick={() => {
                      setFeedMode("digest");
                      setActiveTopic("all");
                      setActiveTimelineIndex(0);
                    }}
                  >
                    <div className="sidebar-nav-icon">
                      <Calendar size={16} className={feedMode === "digest" ? "text-purple-400" : ""} />
                    </div>
                    <div className="sidebar-nav-info">
                      <span className="sidebar-nav-label">Daily Digest</span>
                    </div>
                    <span className="sidebar-badge-pill pill-digest">Daily</span>
                  </button>

                  {/* 3. Trending */}
                  <button
                    type="button"
                    className={`sidebar-nav-item item-trending ${feedMode === "trending" ? "is-active" : ""}`} data-label="Trending"
                    onClick={() => {
                      setFeedMode("trending");
                      setActiveTopic("all");
                      setActiveYear("all");
                      setActiveMonth("all");
                      setActiveCompany("all");
                      setActiveTimelineIndex(0);
                    }}
                  >
                    <div className="sidebar-nav-icon">
                      <Flame size={16} className={feedMode === "trending" ? "text-amber-400" : ""} />
                    </div>
                    <div className="sidebar-nav-info">
                      <span className="sidebar-nav-label">Trending</span>
                    </div>
                    <span className="sidebar-badge-pill pill-hot">Hot</span>
                  </button>

                  {/* 4. Saved */}
                  <button
                    type="button"
                    className={`sidebar-nav-item item-saved ${feedMode === "saved" ? "is-active" : ""}`} data-label="Saved"
                    onClick={() => {
                      setFeedMode("saved");
                      setActiveTopic("all");
                      setActiveYear("all");
                      setActiveMonth("all");
                      setActiveCompany("all");
                      setActiveTimelineIndex(0);
                    }}
                  >
                    <div className="sidebar-nav-icon">
                      <Bookmark size={16} className={savedCount > 0 ? "fill-current" : ""} />
                    </div>
                    <div className="sidebar-nav-info">
                      <span className="sidebar-nav-label">Saved</span>
                    </div>
                    {savedCount > 0 && (
                      <span className="sidebar-badge-pill pill-count">{savedCount}</span>
                    )}
                  </button>

                  {/* 5. Benchmarks */}
                  <button
                    type="button"
                    onClick={() => {
                      setFeedMode("benchmarks");
                      setActiveTopic("all");
                      setActiveTimelineIndex(0);
                      if (typeof window !== "undefined") {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className={`sidebar-nav-item item-benchmarks ${feedMode === "benchmarks" ? "is-active" : ""}`}
                    data-label="Benchmarks"
                  >
                    <div className="sidebar-nav-icon">
                      <BarChart2 size={16} className="text-violet-400" />
                    </div>
                    <div className="sidebar-nav-info">
                      <span className="sidebar-nav-label">Benchmarks</span>
                    </div>
                    <span className="sidebar-badge-pill pill-benchmarks">Compare</span>
                  </button>
                </nav>
              </div>

              {/* Inline filters (year / month / company) */}
              <div className="sidebar-nav-group">
                <div className="sidebar-section-title" style={{ paddingTop: 18, paddingBottom: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    FILTER
                    {(activeYear !== "all" || activeMonth !== "all" || activeCompany !== "all") && (
                      <span className="sidebar-filter-active-dot" title="Active filters applied" />
                    )}
                  </span>
                  {(activeYear !== "all" || activeMonth !== "all" || activeCompany !== "all") && (
                    <button
                      type="button"
                      className="sidebar-filter-reset-btn"
                      onClick={() => {
                        setActiveYear("all");
                        setActiveMonth("all");
                        setActiveCompany("all");
                        setActiveTimelineIndex(0);
                      }}
                      title="Reset all filters"
                    >
                      <RotateCcw size={11} />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
                <nav className="sidebar-nav" aria-label="Filters">
                  <div className="sidebar-filter-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div className="sidebar-nav-icon">
                        <Calendar size={16} />
                      </div>
                      <span className="sidebar-nav-label">Year</span>
                    </div>
                    <SidebarSelect
                      options={facets.years.map((y) => ({ value: y, label: y }))}
                      value={activeYear}
                      onChange={(value) => { setActiveYear(value); setActiveTimelineIndex(0); }}
                      allLabel="All years"
                      ariaLabel="Filter by year"
                      panelMinWidth={140}
                      panelMaxWidth={180}
                    />
                  </div>

                  <div className="sidebar-filter-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div className="sidebar-nav-icon">
                        <CalendarDays size={16} />
                      </div>
                      <span className="sidebar-nav-label">Month</span>
                    </div>
                    <SidebarSelect
                      options={facets.months}
                      value={activeMonth}
                      onChange={(value) => { setActiveMonth(value); setActiveTimelineIndex(0); }}
                      allLabel="All months"
                      ariaLabel="Filter by month"
                      panelMinWidth={140}
                      panelMaxWidth={180}
                    />
                  </div>

                  <div className="sidebar-filter-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div className="sidebar-nav-icon">
                        <Building2 size={16} />
                      </div>
                      <span className="sidebar-nav-label">Company</span>
                    </div>
                    <SidebarSelect
                      options={facets.companies.map((c) => ({ value: c, label: c }))}
                      value={activeCompany}
                      onChange={(value) => { setActiveCompany(value); setActiveTimelineIndex(0); }}
                      allLabel="All companies"
                      ariaLabel="Filter by company"
                      panelMinWidth={200}
                    />
                  </div>
                </nav>
              </div>

              {/* Group 3: Connect */}
              <div className="sidebar-nav-group">
                <div className="sidebar-section-title" style={{ paddingTop: 18, paddingBottom: 8 }}>CONNECT</div>
                <nav className="sidebar-nav" aria-label="Connect">
                  {/* Feedback & Connect */}
                  <button
                    type="button"
                    className={`sidebar-nav-item item-feedback ${feedMode === "feedback" ? "is-active" : ""}`} data-label="Feedback & Connect"
                    onClick={() => {
                      setFeedMode("feedback");
                      setActiveTopic("all");
                      setActiveTimelineIndex(0);
                    }}
                  >
                    <div className="sidebar-nav-icon">
                      <MessageSquare size={16} className={feedMode === "feedback" ? "text-sky-400" : ""} />
                    </div>
                    <div className="sidebar-nav-info">
                      <span className="sidebar-nav-label">Feedback &amp; Connect</span>
                    </div>
                    <span className="sidebar-badge-pill pill-feedback">Connect</span>
                  </button>

                  {/* About */}
                  <button
                    type="button"
                    className={`sidebar-nav-item item-about ${feedMode === "about" ? "is-active" : ""}`} data-label="About NeuBench"
                    onClick={() => {
                      setFeedMode("about");
                      setActiveTopic("all");
                      setActiveTimelineIndex(0);
                    }}
                  >
                    <div className="sidebar-nav-icon">
                      <Info size={16} />
                    </div>
                    <div className="sidebar-nav-info">
                      <span className="sidebar-nav-label">About NeuBench</span>
                    </div>
                  </button>
                </nav>
              </div>

              </div>
          </aside>

          <section aria-label="AI events timeline" className="timeline-column archive-timeline" id="timeline" ref={timelineRef} tabIndex={-1}>
          {feedMode !== "benchmarks" && (
          <section aria-label="Overview" className={`hero-card hero-mode-${feedMode}`}>
            <div className="hero-copy">
              {feedMode === "latest" && (
                <>
                  <span className="hero-kicker">
                    <span className="nav-live-dot" /> The AI landscape • Real-Time Stream
                  </span>
                  <h1 className="hero-title">
                    Every shift.
                    <br />
                    <span className="hero-title-accent">The pulse of AI.</span>
                  </h1>
                  <p className="hero-lede">
                    Explore the companies, models, products and research shaping the future of AI.
                  </p>
                  <div className="hero-stats-strip" aria-label="AI Moments by Category">
                    <button
                      type="button"
                      className={`hero-stat-pill ${activeTopic === "Models" ? "is-active" : ""}`}
                      onClick={() => setActiveTopic(activeTopic === "Models" ? "all" : "Models")}
                    >
                      <Cpu size={15} />
                      <strong>{topicCounts["Models"] ?? 0}</strong> Models
                    </button>
                    <button
                      type="button"
                      className={`hero-stat-pill ${activeTopic === "Products" ? "is-active" : ""}`}
                      onClick={() => setActiveTopic(activeTopic === "Products" ? "all" : "Products")}
                    >
                      <Layers size={15} />
                      <strong>{topicCounts["Products"] ?? 0}</strong> Products
                    </button>
                    <button
                      type="button"
                      className={`hero-stat-pill ${activeTopic === "Research" ? "is-active" : ""}`}
                      onClick={() => setActiveTopic(activeTopic === "Research" ? "all" : "Research")}
                    >
                      <Sparkles size={15} />
                      <strong>{topicCounts["Research"] ?? 0}</strong> Research
                    </button>
                    <button
                      type="button"
                      className={`hero-stat-pill ${activeTopic === "Policy" ? "is-active" : ""}`}
                      onClick={() => setActiveTopic(activeTopic === "Policy" ? "all" : "Policy")}
                    >
                      <BookOpen size={15} />
                      <strong>{topicCounts["Policy"] ?? 0}</strong> Policy
                    </button>
                  </div>
                </>
              )}

              {feedMode === "digest" && (
                <>
                  <div className="hero-digest-badge-row">
                    <span className="hero-kicker kicker-digest">
                      <Calendar size={13} className="text-purple-400" /> Executive AI Briefing • 24h Radar
                    </span>
                    <span className="hero-digest-live-pill">
                      <span className="telemetry-indicator" />
                      <span>LIVE RADAR SYNTHESIS</span>
                    </span>
                  </div>

                  <h1 className="hero-title">
                    Today&apos;s Radar Tracks{" "}
                    <strong>{digestData?.totalStories ?? 30} Moments</strong>
                    <br />
                    Led by{" "}
                    <span className="hero-title-accent-purple">
                      {digestData?.dominantTopic ?? "Models"}
                    </span>
                  </h1>

                  <p className="hero-lede">
                    Frontier activity across the past 24 hours reflects accelerated deployment cycles, with key developments originating from{" "}
                    <strong>
                      {digestData?.companiesLead && digestData.companiesLead.length > 0
                        ? digestData.companiesLead.join(", ")
                        : "OpenAI, Google, Anthropic, DeepSeek, and Meta"}
                    </strong>
                    .
                  </p>

                  <div className="hero-digest-metrics-strip">
                    <div className="digest-metric-chip">
                      <span className="metric-chip-val">{digestData?.totalStories ?? 30}</span>
                      <span className="metric-chip-lbl">Tracked</span>
                    </div>
                    <div className="digest-metric-chip chip-highlight">
                      <span className="metric-chip-val text-purple-400">{digestData?.dominantTopic ?? "Models"}</span>
                      <span className="metric-chip-lbl">Dominant</span>
                    </div>
                    <div className="digest-metric-chip">
                      <span className="metric-chip-val">{digestData?.companiesLead.length ?? 6}</span>
                      <span className="metric-chip-lbl">Active Labs</span>
                    </div>
                    <div className="digest-metric-chip">
                      <span className="metric-chip-val">{digestData?.themes.length ?? 4}</span>
                      <span className="metric-chip-lbl">Macro Themes</span>
                    </div>
                  </div>

                </>
              )}

              {feedMode === "trending" && (
                <>
                  <span className="hero-kicker kicker-trending">
                    <Flame size={12} className="text-amber-400" /> Community Signals • High Velocity
                  </span>
                  <h1 className="hero-title">
                    Trending AI.
                    <br />
                    <span className="hero-title-accent-amber">Community Voted.</span>
                  </h1>
                  <p className="hero-lede">
                    The most impactful breakthroughs and AI shifts ranked by community upvotes, reader discussions, and velocity.
                  </p>
                  <div className="hero-stats-strip" aria-label="Filter Trending Moments">
                    <button
                      type="button"
                      className={`hero-stat-pill ${activeTopic === "all" ? "is-active" : ""}`}
                      onClick={() => setActiveTopic("all")}
                    >
                      All Topics
                    </button>
                    <button
                      type="button"
                      className={`hero-stat-pill ${activeTopic === "Models" ? "is-active" : ""}`}
                      onClick={() => setActiveTopic(activeTopic === "Models" ? "all" : "Models")}
                    >
                      <Cpu size={15} /> Models
                    </button>
                    <button
                      type="button"
                      className={`hero-stat-pill ${activeTopic === "Products" ? "is-active" : ""}`}
                      onClick={() => setActiveTopic(activeTopic === "Products" ? "all" : "Products")}
                    >
                      <Layers size={15} /> Products
                    </button>
                    <button
                      type="button"
                      className={`hero-stat-pill ${activeTopic === "Research" ? "is-active" : ""}`}
                      onClick={() => setActiveTopic(activeTopic === "Research" ? "all" : "Research")}
                    >
                      <Sparkles size={15} /> Research
                    </button>
                    <button
                      type="button"
                      className={`hero-stat-pill ${activeTopic === "Policy" ? "is-active" : ""}`}
                      onClick={() => setActiveTopic(activeTopic === "Policy" ? "all" : "Policy")}
                    >
                      <BookOpen size={15} /> Policy
                    </button>
                  </div>
                </>
              )}

              {feedMode === "saved" && (
                <>
                  <span className="hero-kicker kicker-saved">
                    <Bookmark size={12} className="text-emerald-400 fill-current" /> Personal Dossier
                  </span>
                  <h1 className="hero-title">
                    Saved Collection.
                    <br />
                    <span className="hero-title-accent-emerald">Curated AI Moments.</span>
                  </h1>
                  <p className="hero-lede">
                    {savedCount > 0
                      ? `You have ${savedCount} bookmarked moment${savedCount === 1 ? "" : "s"} saved across your browsing sessions. Review key takeaways, source links, and impact analysis.`
                      : "You haven't saved any stories yet. Tap the bookmark icon on any card across the timeline to curate your personal intelligence briefing."}
                  </p>
                  <div className="hero-action-buttons">
                    <button
                      type="button"
                      className="hero-action-btn btn-primary"
                      onClick={() => {
                        setFeedMode("latest");
                      setActiveTopic("all");
                        setActiveTimelineIndex(0);
                      }}
                    >
                      <Layers size={13} />
                      <span>Browse Latest Stream</span>
                    </button>
                    <button
                      type="button"
                      className="hero-action-btn"
                      onClick={() => {
                        setFeedMode("trending");
                        setActiveTopic("all");
                        setActiveTimelineIndex(0);
                      }}
                    >
                      <Flame size={13} className="text-amber-400" />
                      <span>Explore Trending</span>
                    </button>
                  </div>
                </>
              )}

              {feedMode === "feedback" && (
                <>
                  <span className="hero-kicker kicker-feedback">
                    <MessageSquare size={13} className="text-sky-400" /> Community &amp; Official Channels
                  </span>
                  <h1 className="hero-title">
                    Shape NeuBench.
                    <br />
                    <span className="hero-title-accent-sky">Feedback &amp; Connect.</span>
                  </h1>
                  <p className="hero-lede">
                    Send bug reports, suggest UI/UX enhancements, request feature integrations, or connect directly through our official code repositories and channels.
                  </p>
                  <div className="hero-action-buttons">
                    <button
                      type="button"
                      className="hero-action-btn btn-primary"
                      onClick={() => {
                        setFeedMode("latest");
                      setActiveTopic("all");
                        setActiveTimelineIndex(0);
                      }}
                    >
                      <Sparkles size={13} />
                      <span>Live Stream</span>
                    </button>
                    <button
                      type="button"
                      className="hero-action-btn"
                      onClick={() => {
                        setFeedMode("trending");
                        setActiveTopic("all");
                        setActiveTimelineIndex(0);
                      }}
                    >
                      <Flame size={13} className="text-amber-400" />
                      <span>Trending</span>
                    </button>
                  </div>
                </>
              )}

              {feedMode === "about" && (
                <>
                  <span className="hero-kicker kicker-about">
                    <Sparkles size={13} className="text-violet-400" /> Chronological Intelligence
                  </span>
                  <h1 className="hero-title">
                    Documenting the arc of
                    <br />
                    <span className="hero-title-accent-cyan">artificial intelligence.</span>
                  </h1>
                  <p className="hero-lede">
                    NeuBench is a living historical index and real-time radar tracking the pivotal releases, architectural leaps, and regulatory shifts defining synthetic intelligence.
                  </p>
                  <div className="hero-action-buttons">
                    <button
                      type="button"
                      className="hero-action-btn btn-primary"
                      onClick={() => {
                        setFeedMode("latest");
                      setActiveTopic("all");
                        setActiveTimelineIndex(0);
                      }}
                    >
                      <Sparkles size={13} />
                      <span>Explore Live Stream</span>
                    </button>
                    <button
                      type="button"
                      className="hero-action-btn"
                      onClick={() => {
                        setFeedMode("trending");
                        setActiveTopic("all");
                        setActiveTimelineIndex(0);
                      }}
                    >
                      <Flame size={13} className="text-amber-400" />
                      <span>View Trending</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            {feedMode === "latest" && <HeroLatestArt />}
            {feedMode === "digest" && <HeroDigestArt />}
            {feedMode === "trending" && <HeroTrendingArt />}
            {feedMode === "saved" && <HeroSavedArt />}
            {feedMode === "feedback" && <HeroFeedbackArt />}
            {feedMode === "about" && <HeroAboutArt />}
          </section>
          )}

          {feedMode !== "benchmarks" && hasActiveFilters && activeFilterChips.length > 0 && (
            <div className="timeline-active-filters" role="region" aria-label="Active filters">
              <span className="active-filters-label">Active filters:</span>
              <div className="stream-active-chips">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    className="stream-chip-pill"
                    onClick={chip.clear}
                    type="button"
                    title={`Clear ${chip.name}: ${chip.label}`}
                  >
                    <span>{chip.label}</span>
                    <X size={11} />
                  </button>
                ))}
                <button
                  type="button"
                  className="stream-clear-pill"
                  onClick={clearFilters}
                  title="Clear all active filters"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          {feedMode !== "benchmarks" && semanticConcepts.length > 0 && (
            <div className="semantic-search-banner">
              <div className="semantic-banner-title">
                <Sparkles size={14} />
                <span>AI Semantic Match:</span>
              </div>
              <div className="semantic-concepts-list">
                {semanticConcepts.map((concept) => (
                  <span key={concept} className="semantic-concept-badge">
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}

          {feedMode === "benchmarks" ? (
            <ModelBenchmarksComparator embedded />
          ) : feedMode === "about" ? (
            <AboutBriefingView
              onBrowseLatest={() => {
                setFeedMode("latest");
                setActiveTopic("all");
                setActiveTimelineIndex(0);
              }}
              onBrowseTrending={() => {
                setFeedMode("trending");
                setActiveTopic("all");
                setActiveTimelineIndex(0);
              }}
            />
          ) : feedMode === "digest" ? (
            <DailyDigestMainView
              stories={allStories}
              digestData={digestData}
              onBrowseLatest={() => {
                setFeedMode("latest");
                setActiveTopic("all");
                setActiveTimelineIndex(0);
              }}
              onBrowseTrending={() => {
                setFeedMode("trending");
                setActiveTopic("all");
                setActiveTimelineIndex(0);
              }}
            />
          ) : feedMode === "feedback" ? (
            <FeedbackConnectMainView
              onBrowseLatest={() => {
                setFeedMode("latest");
                setActiveTopic("all");
                setActiveTimelineIndex(0);
              }}
            />
          ) : (
            <>
              <div className="timeline-result-bar">
                <span className="timeline-result-count" role="status" aria-atomic="true">
                  {resultCountLabel}
                </span>
              </div>
              <div className="timeline-list" data-tour-target="timeline">
                {stories.length ? (
                <>
                  {stories.map((story, index) => (
                    <TimelineRow
                      isActive={index === activeTimelineIndex}
                      isExpanded={expandedId === story.id}
                      isLatest={index === 0 && feedMode === "latest"}
                      key={story.id}
                      onToggle={toggleExpanded}
                      showYear={stories[index - 1]?.year !== story.year}
                      story={story}
                      trendingRank={feedMode === "trending" ? index + 1 : topTrendingSlugs.get(story.slug)}
                      upvoteCount={upvoteCounts[story.slug] || 0}
                      isUpvoted={userVotes.has(story.slug)}
                      onVoteChange={handleVoteChange}
                    />
                  ))}
                  {hasMore && <div aria-hidden="true" className="timeline-sentinel" ref={sentinelRef} />}
                </>
              ) : showEmpty ? (
                <div className="empty-state">
                  {feedMode === "saved" ? (
                    <>
                      <Bookmark size={24} className="text-amber-400/80" />
                      <p>{authUser ? "No saved moments yet." : "Saved stories need an account."}</p>
                      <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 12px" }}>
                        {authUser
                          ? "Click the bookmark icon on any story to save it for later."
                          : "Sign in to save stories and keep them across your devices."}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!authUser) {
                            openAuth();
                            return;
                          }
                          setFeedMode("latest");
                          setActiveTopic("all");
                        }}
                      >
                        {authUser ? "Explore latest stories" : "Sign in or create account"}
                      </button>
                    </>
                  ) : (
                    <>
                      <Search size={19} />
                      <p>No moments found.</p>
                      <button type="button" onClick={clearFilters}>
                        Clear filters
                      </button>
                    </>
                  )}
                </div>
              ) : null}
              </div>
            </>
          )}
        </section>
      </div>
      </div>

      {/* Mobile bottom navigation — Timeline (Home is intentionally omitted,
          it scrolled to the same timeline) plus the topic pills. */}
      <nav aria-label="Mobile navigation" className="mobile-bottom-nav">
        <button
          className={`item-latest ${feedMode === "latest" ? "is-active" : ""}`}
          onClick={() => {
            setFeedMode("latest");
            setActiveTimelineIndex(0);
          }}
          type="button"
        >
          <Sparkles aria-hidden="true" size={19} />
          <span className="nav-label">Latest</span>
        </button>
        <button
          className={`item-digest ${feedMode === "digest" ? "is-active" : ""}`}
          onClick={() => {
            setFeedMode("digest");
            setActiveTopic("all");
            setActiveTimelineIndex(0);
          }}
          type="button"
        >
          <Calendar aria-hidden="true" size={19} />
          <span className="nav-label">Digest</span>
        </button>
        <button
          className={`item-trending ${feedMode === "trending" ? "is-active" : ""}`}
          onClick={() => {
            setFeedMode("trending");
            setActiveTopic("all");
            setActiveYear("all");
            setActiveMonth("all");
            setActiveCompany("all");
            setActiveTimelineIndex(0);
          }}
          type="button"
        >
          <Flame aria-hidden="true" size={19} />
          <span className="nav-label">Trending</span>
        </button>
        <button
          className={`item-benchmarks ${feedMode === "benchmarks" ? "is-active" : ""}`}
          onClick={() => {
            setFeedMode("benchmarks");
            setActiveTopic("all");
            setActiveTimelineIndex(0);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          type="button"
        >
          <BarChart2 aria-hidden="true" size={19} />
          <span className="nav-label">Compare</span>
        </button>
        <button
          className={`item-saved ${feedMode === "saved" ? "is-active" : ""}`}
          onClick={() => {
            setFeedMode("saved");
            setActiveTopic("all");
            setActiveYear("all");
            setActiveMonth("all");
            setActiveCompany("all");
            setActiveTimelineIndex(0);
          }}
          type="button"
        >
          <div style={{ position: "relative", display: "inline-flex" }}>
            <Bookmark aria-hidden="true" size={19} />
            {savedCount > 0 && (
              <span className="mobile-saved-badge">{savedCount}</span>
            )}
          </div>
          <span className="nav-label">Saved</span>
        </button>
        <button
          className={`item-feedback ${feedMode === "feedback" ? "is-active" : ""}`}
          onClick={() => {
            setFeedMode("feedback");
            setActiveTopic("all");
            setActiveTimelineIndex(0);
          }}
          type="button"
        >
          <MessageSquare aria-hidden="true" size={19} />
          <span className="nav-label">Connect</span>
        </button>
        <button
          className={`item-about ${feedMode === "about" ? "is-active" : ""}`}
          onClick={() => {
            setFeedMode("about");
            setActiveTopic("all");
            setActiveTimelineIndex(0);
          }}
          type="button"
        >
          <Info aria-hidden="true" size={19} />
          <span className="nav-label">About</span>
        </button>
        <button
          ref={mobileFilterBtnRef}
          aria-controls="mobile-filter-panel"
          aria-expanded={isMobileFilterOpen}
          className={`item-filter ${activeFilterChips.length > 0 ? "has-filters" : ""}`}
          onClick={handleOpenMobileFilter}
          type="button"
        >
          <div style={{ position: "relative", display: "inline-flex" }}>
            <SlidersHorizontal aria-hidden="true" size={19} />
            {activeFilterChips.length > 0 && <span className="mobile-saved-badge">{activeFilterChips.length}</span>}
          </div>
          <span className="nav-label">Filter</span>
        </button>
      </nav>

      {isMobileFilterOpen && (
        <div
          className="mobile-filter-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeMobileFilter();
          }}
        >
          <div
            ref={mobileSheetRef}
            aria-labelledby="mobile-filter-title"
            aria-modal="true"
            className="mobile-filter-sheet"
            id="mobile-filter-panel"
            onKeyDown={handleSheetKeyDown}
            role="dialog"
          >
            <div className="filter-popover-head">
              <div className="filter-popover-title" id="mobile-filter-title">
                <SlidersHorizontal size={13} className="text-violet-400" />
                <span>Filter Moments</span>
              </div>
              <button
                aria-label="Close filter"
                className="filter-popover-close"
                onClick={closeMobileFilter}
                type="button"
              >
                <X size={13} />
              </button>
            </div>

            <FilterFields
              facets={facets}
              idPrefix="sheet"
              year={draftYear}
              month={draftMonth}
              company={draftCompany}
              topic={draftTopic}
              onYearChange={setDraftYear}
              onMonthChange={setDraftMonth}
              onCompanyChange={setDraftCompany}
              onTopicChange={setDraftTopic}
            />

            <div className="filter-popover-foot">
              <button
                type="button"
                className="filter-popover-btn-reset"
                onClick={handleResetFilter}
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>

              <button
                type="button"
                className="filter-popover-btn-apply"
                onClick={handleApplyFilter}
              >
                <Check size={12} strokeWidth={2.4} />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
