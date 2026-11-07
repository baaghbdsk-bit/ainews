import type { Metadata } from "next";
import { Suspense } from "react";
import { getMergedTimeline } from "@/lib/timeline";
import { ExploreTabs } from "@/components/explore-tabs";
import { NeubenchLoadingLogo } from "@/components/loading";

export const metadata: Metadata = {
  title: "Trending AI News & Community Upvotes — NeuBench",
  description:
    "See what the global artificial intelligence community is upvoting and discussing right now across models, research, and tools.",
  alternates: {
    canonical: "/trending",
  },
  openGraph: {
    title: "Trending AI News & Community Upvotes — NeuBench",
    description: "What the community is upvoting and discussing right now.",
    type: "website",
  },
};

export default async function TrendingPage() {
  let stories: Awaited<ReturnType<typeof getMergedTimeline>> = [];
  try {
    stories = await getMergedTimeline();
  } catch {
    stories = [];
  }

  return (
    <Suspense fallback={<NeubenchLoadingLogo variant="fullscreen" size={56} label="Loading Trending AI Radar…" />}>
      <ExploreTabs initialView="trending" stories={stories} />
    </Suspense>
  );
}
