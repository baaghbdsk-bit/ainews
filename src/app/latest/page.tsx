import type { Metadata } from "next";
import { Suspense } from "react";
import { getMergedTimeline } from "@/lib/timeline";
import { ExploreTabs } from "@/components/explore-tabs";
import { NeubenchLoadingLogo } from "@/components/loading";

export const metadata: Metadata = {
  title: "Latest AI News & Breakthroughs — NeuBench",
  description:
    "Real-time feed of the latest artificial intelligence news, research papers, releases, and milestones.",
  alternates: {
    canonical: "/latest",
  },
  openGraph: {
    title: "Latest AI News & Breakthroughs — NeuBench",
    description: "The newest launches, papers, and AI developments as they land.",
    type: "website",
  },
};

export default async function LatestPage() {
  let stories: Awaited<ReturnType<typeof getMergedTimeline>> = [];
  try {
    stories = await getMergedTimeline();
  } catch {
    stories = [];
  }

  return (
    <Suspense fallback={<NeubenchLoadingLogo variant="fullscreen" size={56} label="Loading Latest AI News…" />}>
      <ExploreTabs initialView="latest" stories={stories} />
    </Suspense>
  );
}
