"use client";

import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Cpu,
  Info,
  Layers,
  Orbit,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PAGE_SIZE,
  filterTimelineStories,
  type StoryDisplay,
  type TimelineFacets,
} from "@/lib/timeline-shared";
import { useTheme } from "@/lib/theme";

const topics = [
  { label: "Everything", value: "all" },
  { label: "Models", value: "Models" },
  { label: "Products", value: "Products" },
  { label: "Research", value: "Research" },
  { label: "Policy", value: "Policy" },
] as const;

interface ExploreClientProps {
  /** Every story in the merged timeline; filtering happens client-side. */
  allStories: StoryDisplay[];
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

/** Thousands separators without Intl, so the server and the browser render the
 *  identical string and hydration never flags a mismatch. */
function withThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
}: {
  story: StoryDisplay;
  showYear: boolean;
  isLatest: boolean;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: (id: string) => void;
}) {
  // Feed-derived items build "why it matters" from the summary's own first
  // sentence. Now that the full summary is shown as the OVERVIEW block above,
  // repeating that sentence under WHY IT MATTERS would just duplicate it — so
  // the why-it-matters block is only rendered when it says something the
  // overview doesn't (i.e. curated stories with a real analysis).
  const hasDistinctSignificance = !isRedundantWith(story.summary, story.significance);
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
        <div aria-label={`${story.month} ${story.day}, ${story.year}`} className={`timeline-node node-${story.color}`}>
          <span className="date-day">{story.day}</span>
          <span className="date-month">{story.month}</span>
          {isActive && <span className="timeline-node-runner" />}
        </div>
        <div className="story-content">
          <span className={`story-meta meta-${story.color}`}>
            <span className={`topic-dot dot-${story.color}`} />
            {story.topic}
          </span>
          <div className="story-title-line">
            <Link className="story-title story-title-link" href={`/story/${story.slug}`} prefetch={true} title="Read full story">
              <span className="story-title-text">{story.title}</span>
            </Link>
            <button
              aria-controls={`story-detail-${story.id}`}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Hide" : "Show"} summary for ${story.title}`}
              className={`expand-icon ${isExpanded ? "turned" : ""}`}
              onClick={() => onToggle(story.id)}
              type="button"
              title={isExpanded ? "Hide summary" : "Show summary"}
            >
              <ChevronDown aria-hidden="true" size={17} />
            </button>
          </div>
          {story.summary ? <p className="story-preview">{story.summary}</p> : null}
          <div className={`story-detail-wrap ${isExpanded ? "is-open" : ""}`} id={`story-detail-${story.id}`}>
            <div>
              <div className="detail-inner">
                {story.summary ? (
                  <div className="story-overview">
                    <span className="story-overview-label">Overview</span>
                    <p className="story-summary">{story.summary}</p>
                  </div>
                ) : null}
                {hasDistinctSignificance ? (
                  <div className="why-it-matters">
                    <span>Why it matters</span>
                    <p>{story.significance}</p>
                  </div>
                ) : null}
                <a className="source-link" href={story.sourceUrl} rel="noreferrer" target="_blank">
                  <BookOpen size={14} /> Source: {story.source}
                  <ArrowUpRight size={13} />
                </a>
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

/** Single-select company dropdown. The panel is absolutely positioned flush
 *  against the trigger's bottom edge (`top: 100%`) so the list opens directly
 *  on the field, and flips upward when there isn't room below.
 */
function CompanySelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (selected: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'down' | 'up'>('down');

  useEffect(() => {
    if (!isOpen || !panelRef.current || !triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom - 10;
    const spaceAbove = triggerRect.top - 10;
    setPosition(spaceBelow < panelRect.height && spaceAbove > spaceBelow ? 'up' : 'down');
  }, [isOpen]);

  // Refresh always lands at the top: no scroll restoration, no carried-over filters
  // (filters are client-only state, so a reload returns to the pristine landing page).
  useEffect(() => {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="company-select">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Filter by company"
        className="company-select-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="company-select-trigger-label">{value === 'all' ? 'All companies' : value}</span>
        <ChevronDown size={13} strokeWidth={2} />
      </button>
      {isOpen && (
        <ul
          ref={panelRef}
          role="listbox"
          aria-label="Companies"
          className={`company-select-panel ${position === 'up' ? 'panel-open-up' : ''}`}
        >
          <li role="option" aria-selected={value === 'all'}>
            <button
              type="button"
              className={`company-select-option ${value === 'all' ? 'is-selected' : ''}`}
              onClick={() => {
                onChange('all');
                setIsOpen(false);
              }}
            >
              All companies
            </button>
          </li>
          {options.map((option) => (
            <li key={option} role="option" aria-selected={value === option}>
              <button
                type="button"
                className={`company-select-option ${value === option ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ExploreClient({
  allStories,
  facets,
}: ExploreClientProps) {
  const [activeTopic, setActiveTopic] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeYear, setActiveYear] = useState<string>("all");
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const [activeCompany, setActiveCompany] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isPanelCollapsed, setPanelCollapsed] = useState(false);
  const [isLight, toggleTheme] = useTheme();
  // Mobile/tablet header: the search field is collapsed to an icon and expands
  // in place when tapped.
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isMobileSearchOpen) searchInputRef.current?.focus();
  }, [isMobileSearchOpen]);

  // ── Client-side filtering (instant, no server round-trip) ──────────
  const filtered = useMemo(
    () =>
      filterTimelineStories(allStories, {
        topic: activeTopic,
        year: activeYear,
        month: activeMonth,
        company: activeCompany,
        q: search.trim(),
      }),
    [allStories, activeTopic, activeYear, activeMonth, activeCompany, search],
  );

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
  }, [activeTopic, activeYear, activeMonth, activeCompany, search]);

  const stories = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFilterOpen) {
        setIsFilterOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFilterOpen]);

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
    setActiveTimelineIndex(0);
  };

  const totalStories = allStories.length;
  const shownStories = filtered.length;

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  // Smooth scroll back to the top of the timeline; used by the mobile bottom
  // nav and the mobile menu panel so every nav item has a real destination.
  const scrollToTimeline = useCallback(() => {
    timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  return (
    <main className="site-frame archive-page">
      <header className={`topbar archive-topbar ${isMobileSearchOpen ? "is-mobile-search-open" : ""}`}>
        <div className="header-brand">
          <Link className="wordmark" href="/" aria-label="Signal, home">
            <span className="wordmark-symbol">
              <Orbit size={19} strokeWidth={2.1} />
            </span>
            <span>
              signal<span className="wordmark-period">.</span>
            </span>
          </Link>
          <span className="header-tagline">Intelligence through time.</span>
        </div>

        <label className="header-search">
          <Search aria-hidden="true" size={16} />
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
          {search && (
            <button
              aria-label="Clear search"
              className="clear-search"
              onClick={() => {
                setSearch("");
                setActiveTimelineIndex(0);
              }}
              type="button"
            >
              <X size={14} />
            </button>
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
          <Link
            aria-label="About Signal"
            className="header-about-link"
            href="/about"
            title="About Signal"
          >
            <Info size={16} />
            <span className="header-about-label">About</span>
          </Link>
          <button
            aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
            aria-pressed={isLight}
            className="header-icon-button"
            onClick={toggleTheme}
            title={isLight ? "Dark theme" : "Light theme"}
            type="button"
          >
            <Sun size={17} />
          </button>
        </div>

        {/* Empty on desktop, hidden on mobile — kept so the desktop header's
            grid rows are unchanged after the mobile hamburger was removed. */}
        <div className="mobile-header-actions" />
      </header>

      <div className="archive-shell">
        <div className="archive-layout">
        <section aria-label="AI events timeline" className="timeline-column archive-timeline" id="timeline" ref={timelineRef}>
          <section aria-label="Overview" className="hero-card">
            <div className="hero-copy">
              <span className="hero-kicker">The AI landscape</span>
              <h1 className="hero-title">
                Every shift.
                <br />
                <span className="hero-title-accent">Every signal.</span>
              </h1>
              <p className="hero-lede">
                Explore the companies, models, products and research shaping the future of AI.
              </p>
              <span className="hero-count">
                <Layers aria-hidden="true" size={14} />
                {withThousands(totalStories)} moments tracked
              </span>
            </div>
            <div aria-hidden="true" className="hero-art">
              <span className="hero-globe" />
              <svg className="hero-orbit" viewBox="0 0 240 240">
                <ellipse cx="120" cy="120" rx="104" ry="40" />
                <ellipse cx="120" cy="120" rx="104" ry="76" />
                <ellipse cx="120" cy="120" rx="76" ry="104" />
                <ellipse cx="120" cy="120" rx="40" ry="104" />
              </svg>
            </div>
          </section>
          <div className="timeline-list" aria-live="polite">
            {stories.length ? (
              <>
                {stories.map((story, index) => (
                  <TimelineRow
                    isActive={index === activeTimelineIndex}
                    isExpanded={expandedId === story.id}
                    isLatest={index === 0}
                    key={story.id}
                    onToggle={toggleExpanded}
                    showYear={stories[index - 1]?.year !== story.year}
                    story={story}
                  />
                ))}
                {hasMore && <div aria-hidden="true" className="timeline-sentinel" ref={sentinelRef} />}
              </>
            ) : showEmpty ? (
              <div className="empty-state">
                <Search size={19} />
                <p>No moments found.</p>
                <button type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {/* `data-open` must be absent (not "false") when closed — every
            `[data-open]` CSS selector would otherwise match a closed panel. */}
        <aside aria-label="Timeline filters" className="archive-filter-panel" id="archive-filter-panel" data-open={isFilterOpen ? "true" : undefined}>
          <button
            aria-controls="archive-filter-body"
            aria-expanded={!isPanelCollapsed}
            className="filter-panel-head"
            onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
            type="button"
          >
            <span className="filter-panel-icon">
              <SlidersHorizontal size={15} strokeWidth={2} />
            </span>
            <h2>Filter &amp; Search</h2>
            <ChevronDown
              aria-hidden="true"
              className={`filter-panel-chevron ${isPanelCollapsed ? "is-collapsed" : ""}`}
              size={16}
            />
          </button>

          <div className={`filter-panel-body ${isPanelCollapsed ? "is-collapsed" : ""}`} id="archive-filter-body">
          <div className="filter-group">
            <label className="filter-group-label" htmlFor="archive-filter-year">
              Period
            </label>
            <select
              aria-label="Filter by year"
              className="date-filter-select"
              id="archive-filter-year"
              onChange={(event) => {
                setActiveYear(event.target.value);
                setActiveTimelineIndex(0);
              }}
              value={activeYear}
            >
              <option value="all">All years</option>
              {facets.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-group-label" htmlFor="archive-filter-month">
              Month
            </label>
            <select
              aria-label="Filter by month"
              className="date-filter-select"
              id="archive-filter-month"
              onChange={(event) => {
                setActiveMonth(event.target.value);
                setActiveTimelineIndex(0);
              }}
              value={activeMonth}
            >
              <option value="all">All months</option>
              {facets.months.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Company</span>
            <CompanySelect
              options={facets.companies}
              value={activeCompany}
              onChange={(selected) => {
                setActiveCompany(selected);
                setActiveTimelineIndex(0);
              }}
            />
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Category</span>
            <div aria-label="Filter timeline by category" className="category-chips" role="group">
              {topics.map(({ label, value }) => (
                <button
                  aria-pressed={activeTopic === value}
                  className={`category-chip ${activeTopic === value ? "is-active" : ""}`}
                  key={value}
                  onClick={() => {
                    setActiveTopic(value);
                    setActiveTimelineIndex(0);
                  }}
                  type="button"
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="filter-panel-foot">
            <button className="filter-clear-button" disabled={!hasActiveFilters} onClick={clearFilters} type="button">
              Clear filter
            </button>
            <p className="filter-result-count" aria-live="polite">
              Showing {withThousands(shownStories)} of {withThousands(totalStories)} moments
            </p>
          </div>
          </div>
        </aside>
      </div>
      </div>

      {/* Mobile bottom navigation — Timeline (Home is intentionally omitted,
          it scrolled to the same timeline) plus the topic pills. */}
      <nav aria-label="Mobile navigation" className="mobile-bottom-nav">
        <button
          className={activeTopic === "all" ? "is-active" : ""}
          onClick={() => {
            clearFilters();
            scrollToTimeline();
          }}
          type="button"
        >
          <Layers aria-hidden="true" size={20} />
          <span className="nav-label">Timeline</span>
        </button>
        <button
          className={activeTopic === "Models" ? "is-active" : ""}
          onClick={() => {
            setActiveTopic("Models");
            setActiveTimelineIndex(0);
            scrollToTimeline();
          }}
          type="button"
        >
          <Cpu aria-hidden="true" size={20} />
          <span className="nav-label">Models</span>
        </button>
        <button
          className={activeTopic === "Products" ? "is-active" : ""}
          onClick={() => {
            setActiveTopic("Products");
            setActiveTimelineIndex(0);
            scrollToTimeline();
          }}
          type="button"
        >
          <Cpu aria-hidden="true" size={20} />
          <span className="nav-label">Products</span>
        </button>
        <button
          className={activeTopic === "Research" ? "is-active" : ""}
          onClick={() => {
            setActiveTopic("Research");
            setActiveTimelineIndex(0);
            scrollToTimeline();
          }}
          type="button"
        >
          <Cpu aria-hidden="true" size={20} />
          <span className="nav-label">Research</span>
        </button>
        <button
          className={activeTopic === "Policy" ? "is-active" : ""}
          onClick={() => {
            setActiveTopic("Policy");
            setActiveTimelineIndex(0);
            scrollToTimeline();
          }}
          type="button"
        >
          <Cpu aria-hidden="true" size={20} />
          <span className="nav-label">Policy</span>
        </button>
      </nav>

      {/* Mobile filter trigger — the only entry point to the filter panel on
          small screens; sits just above the bottom nav. */}
      <button
        aria-controls="archive-filter-panel"
        aria-expanded={isFilterOpen}
        className="archive-mobile-filter"
        onClick={() => setIsFilterOpen((open) => !open)}
        type="button"
      >
        <SlidersHorizontal aria-hidden="true" size={14} />
        Filter
        {activeFilterChips.length > 0 && <span className="filter-mobile-count">{activeFilterChips.length}</span>}
      </button>
    </main>
  );
}
