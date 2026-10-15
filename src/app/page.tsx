import { Suspense } from "react";
import { fetchAiNews } from "@/lib/feeds/fetch-ai-news";
import { getPublishedStories } from "@/lib/actions/stories";
import { stories as seedStories } from "./stories";
import { ExploreClient, type StoryDisplay } from "./explore-client";
import type { Story } from "@/lib/schemas/story";

/**
 * Convert seed stories to match Story type for DB-compatible format
 */
function convertSeedStory(story: typeof seedStories[0]): Story {
  // Derived from the story own date so the page stays prerenderable —
  // `new Date()` is unstable during prerender and blocks the static shell.
  const stableTimestamp = `${story.date}T00:00:00.000Z`;
  return {
    id: story.id,
    slug: story.title.toLowerCase().replace(/\s+/g, "-"),
    title: story.title,
    summary: story.summary,
    significance: story.significance,
    source: story.source,
    source_url: story.sourceUrl,
    topic: story.topic,
    event_date: story.date,
    published_at: stableTimestamp,
    status: "published" as const,
    created_by: "seed",
    updated_by: "seed",
    created_at: stableTimestamp,
    updated_at: stableTimestamp,
  };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Project a Story down to only the fields the timeline renders, so the full
 * database row (timestamps, audit columns, status) never ships to the browser.
 */
function formatStoryForDisplay(story: Story, color: string) {
  const [year, month, day] = story.event_date.split("-");

  return {
    id: story.id || story.slug,
    slug: story.slug,
    title: story.title,
    summary: story.summary,
    significance: story.significance,
    source: story.source,
    sourceUrl: story.source_url,
    topic: story.topic,
    date: story.event_date,
    day: day.replace(/^0/, ""),
    month: MONTH_NAMES[parseInt(month, 10) - 1],
    year,
    color,
  } satisfies StoryDisplay;
}

export default function HomePage() {
  // The shell paints immediately; the cached data resolves behind this boundary
  // instead of blocking the whole navigation.
  return (
    <Suspense fallback={<TimelineFallback />}>
      <Timeline />
    </Suspense>
  );
}

async function Timeline() {
  const [liveStories, dbStories] = await Promise.all([
    fetchAiNews(),
    getPublishedStories(),
  ]);
  const seedConverted = seedStories.map(convertSeedStory);

  // Merge live RSS with DB + seed history so the timeline spans multiple years,
  // de-duplicating by URL and by (title, date).
  const merged: Story[] = [];
  const seenUrls = new Set<string>();
  const seenTitleDate = new Set<string>();
  const pushStory = (story: Story) => {
    const titleDate = `${story.title.trim().toLowerCase()}|${story.event_date}`;
    if (seenUrls.has(story.source_url) || seenTitleDate.has(titleDate)) return;
    seenUrls.add(story.source_url);
    seenTitleDate.add(titleDate);
    merged.push(story);
  };
  [...liveStories, ...(dbStories ?? []), ...seedConverted].forEach(pushStory);
  merged.sort((a, b) => b.event_date.localeCompare(a.event_date));

  const colors = ["blue", "purple", "cyan", "amber", "rose"];
  const stories = merged.map((s, i) => formatStoryForDisplay(s, colors[i % colors.length]));

  return <ExploreClient initialStories={stories} />;
}

/**
 * Same frame as the real timeline so the first paint never flashes an empty
 * page before the story list streams in.
 */
function TimelineFallback() {
  return (
    <main className="site-frame archive-page">
      <header className="topbar archive-topbar">
        <span className="wordmark">
          <span className="wordmark-symbol" aria-hidden="true" />
          <span>
            signal<span className="wordmark-period">.</span>
          </span>
        </span>
        <span className="topbar-link">Archive</span>
      </header>
      <div className="archive-timeline">
        <div className="timeline-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="timeline-item" key={i} style={{ opacity: 0.45 }}>
              <div className="story-row">
                <div className="timeline-node">
                  <span className="date-day" />
                  <span className="date-month" />
                </div>
                <div className="story-content">
                  <div
                    style={{
                      height: 14,
                      width: `${72 - i * 6}%`,
                      background: "rgba(255,255,255,0.14)",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}