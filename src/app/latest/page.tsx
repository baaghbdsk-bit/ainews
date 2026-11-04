import { Suspense } from "react";
import type { Metadata } from "next";
import { getMergedTimeline } from "@/lib/timeline";
import { computeFacets } from "@/lib/timeline-shared";
import { ExploreClient } from "../explore-client";

export const metadata: Metadata = {
  alternates: { canonical: "/latest" },
};

const INITIAL_STORY_WINDOW = 10;

export default function LatestPage() {
  return (
    <Suspense fallback={<LatestFallback />}>
      <Latest />
    </Suspense>
  );
}

async function Latest() {
  const merged = await getMergedTimeline();
  return (
    <ExploreClient
      facets={computeFacets(merged)}
      initialStories={merged.slice(0, INITIAL_STORY_WINDOW)}
    />
  );
}

function LatestFallback() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--fg-muted)",
        fontSize: 14,
      }}
    >
      Loading latest…
    </div>
  );
}
