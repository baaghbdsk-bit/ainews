import type { Metadata } from "next";
import { getMergedTimeline } from "@/lib/timeline";
import { ExploreTabs } from "@/components/explore-tabs";

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

export const revalidate = 60;

export default async function LatestPage() {
  let stories: Awaited<ReturnType<typeof getMergedTimeline>> = [];
  try {
    stories = await getMergedTimeline();
  } catch (err) {
    console.error("Failed to load timeline on LatestPage:", err);
    stories = [];
  }
  return <ExploreTabs initialView="latest" stories={stories} />;
}
