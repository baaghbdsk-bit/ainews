import type { Metadata } from "next";
import { connection } from "next/server";
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

export default async function LatestPage() {
  await connection();
  const stories = await getMergedTimeline();
  return <ExploreTabs initialView="latest" stories={stories} />;
}
