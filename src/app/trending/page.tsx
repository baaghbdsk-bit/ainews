import type { Metadata } from "next";
import { connection } from "next/server";
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

export default async function TrendingPage() {
  await connection();
  const stories = await getMergedTimeline();
  return <ExploreTabs initialView="trending" stories={stories} />;
}
