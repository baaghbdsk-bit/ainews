import { Suspense } from "react";
import type { Metadata } from "next";
import { getMergedTimeline } from "@/lib/timeline";
import { computeFacets } from "@/lib/timeline-shared";
import { ExploreClient } from "./explore-client";
import { SiteHeader } from "./site-header";

/**
 * Rows rendered into the document. The client takes over from here and pulls
 * the rest of the merge in the background, so the document stays small enough
 * to paint quickly.
 */
const INITIAL_STORY_WINDOW = 10;

/**
 * The layout's relative canonical ("../") resolves to "/index" for the root
 * route on the deployed host, so the homepage declares its own. Sub-routes
 * still resolve correctly from the layout.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

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
  const merged = await getMergedTimeline();

  return (
    <ExploreClient
      facets={computeFacets(merged)}
      initialStories={merged.slice(0, INITIAL_STORY_WINDOW)}
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
                    className="h-[14px] w-full bg-white/14 rounded-full"
                    style={{ width: `${72 - i * 6}%` }}
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
