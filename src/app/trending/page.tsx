import type { Metadata } from "next";
import { getMergedTimeline } from "@/lib/timeline";
import { ExploreTabs } from "@/components/explore-tabs";

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

export const revalidate = 60;

export default async function TrendingPage() {
  let stories: Awaited<ReturnType<typeof getMergedTimeline>> = [];
  try {
    stories = await getMergedTimeline();
  } catch (err) {
    console.error("Failed to load timeline on TrendingPage:", err);
    stories = [];
  }
  return <ExploreTabs initialView="trending" stories={stories} />;
}
