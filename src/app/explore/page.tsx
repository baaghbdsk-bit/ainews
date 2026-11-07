import { Suspense } from "react";
import type { Metadata } from "next";
import { getMergedTimeline } from "@/lib/timeline";
import { ExploreTabs } from "@/components/explore-tabs";
import { NeubenchLoadingLogo } from "@/components/loading";

export const metadata: Metadata = {
  title: "Live AI News Stream & Breakthrough Radar",
  description:
    "Real-time one-stop feed of all global artificial intelligence developments. Filter by date, lab, company, or topic. Read verified AI news without visiting 10 different sites.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Live AI News Stream — NeuBench",
    description:
      "The living pulse of artificial intelligence: real-time news, model releases, and breakthroughs in a single unified stream.",
  },
};

export default async function ExplorePage() {
  let stories: Awaited<ReturnType<typeof getMergedTimeline>> = [];
  try {
    stories = await getMergedTimeline();
  } catch {
    stories = [];
  }

  return (
    <Suspense fallback={<NeubenchLoadingLogo variant="fullscreen" size={56} label="Loading AI intelligence radar…" />}>
      <ExploreTabs stories={stories} />
    </Suspense>
  );
}
