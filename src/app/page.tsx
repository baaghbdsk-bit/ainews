import { Suspense } from "react";
import { getMergedTimeline, getTimelinePage } from "@/lib/timeline";
import { computeFacets, PAGE_SIZE } from "@/lib/timeline-shared";
import { ExploreClient } from "./explore-client";
import { SiteHeader } from "./site-header";

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
  // Only the first page is server-rendered into the RSC payload — the rest of
  // the timeline loads from /api/stories on scroll and on every filter change,
  // so the homepage no longer serializes ~1,000 stories to the browser.
  // getTimelinePage and getMergedTimeline share the same 'use cache' entry, so
  // the second call is a cache read, not a refetch.
  const [page, merged] = await Promise.all([
    getTimelinePage({}, 0, PAGE_SIZE),
    getMergedTimeline(),
  ]);

  return (
    <ExploreClient
      facets={computeFacets(merged)}
      initialStories={page.stories}
      initialTotal={page.total}
      matchingTotal={page.matching}
    />
  );
}

/**
 * Same frame as the real timeline so the first paint never flashes an empty
 * page before the story list streams in.
 */
function TimelineFallback() {
  return (
    <main className="site-frame archive-page">
      <SiteHeader right={<span className="topbar-link">Archive</span>} />
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
