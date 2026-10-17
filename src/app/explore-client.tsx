"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  Compass,
  FilterX,
  FlaskConical,
  Landmark,
  Orbit,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  PAGE_SIZE,
  type StoryDisplay,
  type TimelineFacets,
  type TimelineFilters,
} from "@/lib/timeline-shared";

const topics = [
  { label: "Everything", value: "all", icon: Compass },
  { label: "Models", value: "Models", icon: BrainCircuit },
  { label: "Products", value: "Products", icon: Sparkles },
  { label: "Research", value: "Research", icon: FlaskConical },
  { label: "Policy", value: "Policy", icon: Landmark },
] as const;

interface ExploreClientProps {
  /** First page, server-rendered; further pages come from /api/stories. */
  initialStories: StoryDisplay[];
  /** Unfiltered total across the whole merged timeline. */
  initialTotal: number;
  /** Stories matching the current filters (1:1 with initialStories on load). */
  matchingTotal: number;
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

/**
 * One timeline row. Memoized so that scroll-driven state changes (the active
 * node highlight) only re-render the rows whose props actually changed instead
 * of reconciling the whole list.
 */
const TimelineRow = memo(function TimelineRow({
  story,
  showYear,
  isExpanded,
  isActive,
  onToggle,
}: {
  story: StoryDisplay;
  showYear: boolean;
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
        </div>
      )}
      <div className="story-row">
        <div aria-label={`${story.month} ${story.day}, ${story.year}`} className={`timeline-node node-${story.color}`}>
          <span className="date-day">{story.day}</span>
          <span className="date-month">{story.month}</span>
          {isActive && <span className="timeline-node-runner" />}
        </div>
        <div className="story-content">
          <span className="story-meta">
            <span className={`topic-dot dot-${story.color}`} />
            {story.topic}
          </span>
          <div className="story-title-line">
            <Link className="story-title story-title-link" href={`/story/${story.slug}`} prefetch={true} title="Read full story">
              <span className="story-title-text">{story.title}</span>
              <ArrowRight aria-hidden="true" className="story-open-icon" size={14} />
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
      </div>
    </article>
  );
});

type TopicTabsProps = {
  activeTopic: string;
  onSelect: (value: string) => void;
};

/** Topic filter rendered as a horizontal pill bar above the archive layout. */
function TopicTabs({ activeTopic, onSelect }: TopicTabsProps) {
  return (
    <div className="topic-tabs-bar">
      <div className="topic-tabs-scroll">
        <nav aria-label="Filter timeline by topic" className="topic-nav archive-topic-nav" role="tablist">
          {topics.map(({ label, value, icon: Icon }) => (
            <button
              aria-selected={activeTopic === value}
              className={`topic-button ${activeTopic === value ? "is-active" : ""}`}
              key={value}
              onKeyDown={(event) => {
                const currentIndex = topics.findIndex((topic) => topic.value === value);
                let nextIndex = currentIndex;
                if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % topics.length;
                else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + topics.length) % topics.length;
                else if (event.key === "Home") nextIndex = 0;
                else if (event.key === "End") nextIndex = topics.length - 1;
                else return;

                event.preventDefault();
                onSelect(topics[nextIndex].value);
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
              }}
              onClick={() => onSelect(value)}
              role="tab"
              tabIndex={activeTopic === value ? 0 : -1}
              type="button"
            >
              <Icon size={15} strokeWidth={1.8} />
              <span>{label}</span>
              {activeTopic === value && (
                <span className="topic-active-mark">
                  <Check size={12} />
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** Single-select company dropdown. The panel is absolutely positioned flush
 * against the trigger's bottom edge (`top: 100%`) so the list opens directly
 * on the field, and flips upward when there isn't room below.
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
  initialStories,
  initialTotal,
  matchingTotal,
  facets,
}: ExploreClientProps) {
  const [activeTopic, setActiveTopic] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeYear, setActiveYear] = useState<string>("all");
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const [activeCompany, setActiveCompany] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [stories, setStories] = useState<StoryDisplay[]>(initialStories);
  const [matching, setMatching] = useState(matchingTotal);
  const [hasMore, setHasMore] = useState(initialStories.length < matchingTotal);
  // isFiltering: a filter/search refetch that will REPLACE the list.
  // isLoadingMore: an infinite-scroll fetch that will APPEND to the list.
  const [isFiltering, setIsFiltering] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);
  const timelineRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Single-flight fetch: a new request always supersedes the running one, and
  // only the request that is still current gets to touch loading state.
  const inFlightRef = useRef<AbortController | null>(null);

  // Latest filter values for fetches started from effects/observers without
  // re-subscribing them on every keystroke.
  const filtersRef = useRef<TimelineFilters>({});
  useEffect(() => {
    filtersRef.current = {
      topic: activeTopic,
      year: activeYear,
      month: activeMonth,
      company: activeCompany,
      q: search.trim(),
    };
  }, [activeTopic, activeYear, activeMonth, activeCompany, search]);

  const fetchPage = useCallback(
    (filters: TimelineFilters, offset: number, mode: "replace" | "append") => {
      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;

      // A replace cancels any pending append (and vice versa via the abort
      // above) so the two flags can never both stick on.
      setIsFiltering(mode === "replace");
      setIsLoadingMore(mode === "append");

      const params = new URLSearchParams();
      if (filters.topic && filters.topic !== "all") params.set("topic", filters.topic);
      if (filters.year && filters.year !== "all") params.set("year", filters.year);
      if (filters.month && filters.month !== "all") params.set("month", filters.month);
      if (filters.company && filters.company !== "all") params.set("company", filters.company);
      if (filters.q) params.set("q", filters.q);
      params.set("offset", String(offset));
      params.set("limit", String(PAGE_SIZE));

      (async () => {
        try {
          const res = await fetch(`/api/stories?${params.toString()}`, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as {
            stories: StoryDisplay[];
            total: number;
            matching: number;
            hasMore: boolean;
          };
          setStories((prev) => (mode === "append" ? [...prev, ...data.stories] : data.stories));
          setMatching(data.matching);
          setHasMore(data.hasMore);
          setLoadError(false);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error("Failed to load timeline page:", err);
          // Keep whatever is on screen; surface the error only when the list
          // would otherwise render empty.
          setLoadError(true);
        } finally {
          if (inFlightRef.current === controller) {
            inFlightRef.current = null;
            setIsFiltering(false);
            setIsLoadingMore(false);
          }
        }
      })();
    },
    [],
  );

  // Skip the initial mount — SSR already delivered page one.
  const skipDiscreteFetch = useRef(true);
  const skipSearchFetch = useRef(true);

  // Discrete filter changes refetch immediately (replace).
  useEffect(() => {
    if (skipDiscreteFetch.current) {
      skipDiscreteFetch.current = false;
      return;
    }
    setActiveTimelineIndex(0);
    fetchPage(filtersRef.current, 0, "replace");
  }, [activeTopic, activeYear, activeMonth, activeCompany, fetchPage]);

  // Search is debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    if (skipSearchFetch.current) {
      skipSearchFetch.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setActiveTimelineIndex(0);
      fetchPage(filtersRef.current, 0, "replace");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, fetchPage]);

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

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Throttled to one appended page at a time; the sentinel only qualifies
    // again once the list has grown and it has been pushed out of range.
    let pending = 0;
    const check = () => {
      if (pending || isFiltering || isLoadingMore) return;
      if (sentinel.getBoundingClientRect().top > window.innerHeight + 800) return;
      pending = window.setTimeout(() => {
        pending = 0;
      }, 120);
      fetchPage(filtersRef.current, stories.length, "append");
    };

    // IntersectionObserver covers the no-scroll case; the scroll/resize listeners
    // keep the list growing where observer delivery is unavailable.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) check();
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(sentinel);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    check();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      if (pending) window.clearTimeout(pending);
    };
  }, [hasMore, stories.length, isFiltering, isLoadingMore, fetchPage]);

  // Abort any in-flight request on unmount so state updates never land late.
  useEffect(() => {
    const inFlight = inFlightRef;
    return () => inFlight.current?.abort();
  }, []);

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

  const totalStories = initialTotal;
  const shownStories = matching;

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const retryLoad = useCallback(() => {
    fetchPage(filtersRef.current, 0, "replace");
  }, [fetchPage]);

  const showEmpty = stories.length === 0 && !isFiltering && !loadError;

  return (
    <main className="site-frame archive-page">
      <header className="topbar archive-topbar">
        <Link className="wordmark" href="/" aria-label="Signal, home">
          <span className="wordmark-symbol">
            <Orbit size={19} strokeWidth={2.1} />
          </span>
          <span>
            signal<span className="wordmark-period">.</span>
          </span>
        </Link>
        <TopicTabs
          activeTopic={activeTopic}
          onSelect={(value) => {
            setActiveTopic(value);
            setActiveTimelineIndex(0);
          }}
        />
      </header>

      <div className="archive-layout">
        <section aria-label="AI events timeline" className="timeline-column archive-timeline" id="timeline" ref={timelineRef}>
          <div aria-busy={isFiltering || isLoadingMore} className="timeline-list" aria-live="polite">
            {stories.length ? (
              <>
                {stories.map((story, index) => (
                  <TimelineRow
                    isActive={index === activeTimelineIndex}
                    isExpanded={expandedId === story.id}
                    key={story.id}
                    onToggle={toggleExpanded}
                    showYear={stories[index - 1]?.year !== story.year}
                    story={story}
                  />
                ))}
                {hasMore && <div aria-hidden="true" className="timeline-sentinel" ref={sentinelRef} />}
              </>
            ) : loadError ? (
              <div className="empty-state">
                <Search size={19} />
                <p>Couldn&rsquo;t load stories.</p>
                <button type="button" onClick={retryLoad}>
                  Try again
                </button>
              </div>
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

        <aside aria-label="Timeline filters" className="archive-filter-panel" id="archive-filter-panel" data-open={isFilterOpen}>
          <div className="filter-panel-head">
            <span className="filter-panel-icon">
              <SlidersHorizontal size={15} strokeWidth={2} />
            </span>
            <h2>Timeline filter</h2>
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Period</span>
            <div className="date-filter" role="group" aria-label="Filter timeline by month and year">
              <select
                aria-label="Filter by year"
                className="date-filter-select"
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
              <select
                aria-label="Filter by month"
                className="date-filter-select"
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
            <label className="filter-group-label" htmlFor="archive-filter-search">
              Search
            </label>
            <label className="search-box archive-search">
              <Search size={16} />
              <input
                aria-label="Search AI timeline"
                id="archive-filter-search"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActiveTimelineIndex(0);
                }}
                placeholder="Search stories"
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
            </label>
          </div>

          <div className="filter-panel-foot">
            <p className="filter-result-count" aria-live="polite">
              Showing <strong>{shownStories}</strong> of {totalStories} moments
            </p>
            <button className="filter-clear-button" disabled={!hasActiveFilters} onClick={clearFilters} type="button">
              <FilterX size={14} />
              Clear filters
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
