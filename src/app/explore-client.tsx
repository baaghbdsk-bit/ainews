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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const topics = [
  { label: "Everything", value: "all", icon: Compass },
  { label: "Models", value: "Models", icon: BrainCircuit },
  { label: "Products", value: "Products", icon: Sparkles },
  { label: "Research", value: "Research", icon: FlaskConical },
  { label: "Policy", value: "Policy", icon: Landmark },
] as const;

export interface StoryDisplay {
  id: string;
  slug: string;
  title: string;
  summary: string;
  significance: string;
  source: string;
  sourceUrl: string;
  topic: "Models" | "Products" | "Research" | "Policy";
  date: string;
  day: string;
  month: string;
  year: string;
  color: string;
}

interface ExploreClientProps {
  initialStories: StoryDisplay[];
}

// How many rows exist in the DOM at once; more are appended as the reader scrolls.
const PAGE_SIZE = 60;

// Lowercased search haystack per story, built once instead of on every keystroke.
const searchTextCache = new WeakMap<StoryDisplay, string>();
function haystackOf(story: StoryDisplay): string {
  let text = searchTextCache.get(story);
  if (text === undefined) {
    text = `${story.title} ${story.summary} ${story.significance} ${story.source} ${story.topic} ${story.date}`.toLowerCase();
    searchTextCache.set(story, text);
  }
  return text;
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

export function ExploreClient({ initialStories }: ExploreClientProps) {
  const [activeTopic, setActiveTopic] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeYear, setActiveYear] = useState<string>("all");
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const timelineRef = useRef<HTMLElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

      const years = useMemo(
        () => Array.from(new Set(initialStories.map((s) => s.year))).sort((a, b) => b.localeCompare(a)),
        [initialStories],
      );
      const monthOptions = useMemo(
        () =>
          Array.from(new Map(initialStories.map((s) => [s.date.slice(5, 7), s.month])).entries()).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        [initialStories],
      );

      const filteredStories = useMemo(
        () =>
          initialStories.filter((story) => {
            const matchesTopic = activeTopic === "all" || story.topic === activeTopic;
            const matchesYear = activeYear === "all" || story.year === activeYear;
            const matchesMonth = activeMonth === "all" || story.date.slice(5, 7) === activeMonth;
            return matchesTopic && matchesYear && matchesMonth && haystackOf(story).includes(search.toLowerCase().trim());
          }),
        [initialStories, activeTopic, activeYear, activeMonth, search],
      );

      // Only the first `visibleCount` rows are mounted; the sentinel below the list
      // tops it up as the reader approaches the end.
      const visibleStories = useMemo(() => filteredStories.slice(0, visibleCount), [filteredStories, visibleCount]);
      const hasMore = visibleCount < filteredStories.length;

      const filterKey = `${activeTopic}|${activeYear}|${activeMonth}|${search}`;
      const [lastFilterKey, setLastFilterKey] = useState(filterKey);

      // Reset the mounted window when the filter set changes. Comparing the
      // previous filter key during render is the documented alternative to
      // syncing it back in an effect.
      if (filterKey !== lastFilterKey) {
        setLastFilterKey(filterKey);
        setVisibleCount(PAGE_SIZE);
      }

      useEffect(() => {
        const handleScroll = () => {
          if (!timelineRef.current) return;
          const timeline = timelineRef.current;

          // Calculate progress based on scroll position
          const scrollTop = timeline.scrollTop || (timeline.parentElement?.scrollTop || 0);
          const scrollHeight = timeline.scrollHeight - timeline.clientHeight;
          if (scrollHeight <= 0) return;
          
          const progress = Math.max(0, Math.min(1, scrollTop / scrollHeight));
          const newIndex = Math.round(progress * Math.max(filteredStories.length - 1, 0));
          
          // Only update on significant index changes to prevent render thrashing
          if (newIndex !== activeTimelineIndex) {
            setActiveTimelineIndex(newIndex);
          }
        };

        const throttleTimer = setInterval(handleScroll, 50);
        return () => clearInterval(throttleTimer);
      }, [activeTimelineIndex, filteredStories.length]);

      useEffect(() => {
        if (!hasMore) return;
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        // Throttled to one appended page at a time; the sentinel only qualifies
        // again once the list has grown and it has been pushed out of range.
        let pending = 0;
        const check = () => {
          if (pending) return;
          if (sentinel.getBoundingClientRect().top > window.innerHeight + 800) return;
          pending = window.setTimeout(() => {
            pending = 0;
          }, 120);
          setVisibleCount((count) => count + PAGE_SIZE);
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
      }, [hasMore, visibleStories.length]);

      const hasActiveFilters =
        activeTopic !== "all" || activeYear !== "all" || activeMonth !== "all" || search.trim() !== "";

      const clearFilters = () => {
        setSearch("");
        setActiveTopic("all");
        setActiveYear("all");
        setActiveMonth("all");
        setActiveTimelineIndex(0);
      };

      const totalStories = initialStories.length;
            const shownStories = filteredStories.length;

                  const toggleExpanded = useCallback((id: string) => {
                    setExpandedId((current) => (current === id ? null : id));
                  }, []);

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
          <div className="timeline-list" aria-live="polite">
            {filteredStories.length ? (
                                      <>
                            {visibleStories.map((story, index) => (
                              <TimelineRow
                                isActive={index === activeTimelineIndex}
                                isExpanded={expandedId === story.id}
                                key={story.id}
                                onToggle={toggleExpanded}
                                showYear={filteredStories[index - 1]?.year !== story.year}
                                story={story}
                              />
                            ))}
                            {hasMore && <div aria-hidden="true" className="timeline-sentinel" ref={sentinelRef} />}
                                            </>
                        ) : (
              <div className="empty-state">
                <Search size={19} />
                <p>No moments found.</p>
                            <button type="button" onClick={clearFilters}>
                              Clear filters
                            </button>
                          </div>
                        )}
                      </div>
                      </section>

                      <aside aria-label="Timeline filters" className="archive-filter-panel">
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
                              {years.map((year) => (
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
                              {monthOptions.map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
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
