import { Suspense } from "react";
import type { Metadata } from "next";
import { getMergedTimeline } from "@/lib/timeline";
import { ExploreTabs } from "@/components/explore-tabs";

export const metadata: Metadata = {
  title: "Explore — NeuBench",
  alternates: { canonical: "/explore" },
};

export default async function ExplorePage() {
  let stories: Awaited<ReturnType<typeof getMergedTimeline>> = [];
  try {
    stories = await getMergedTimeline();
  } catch {
    stories = [];
  }

  return (
    <Suspense fallback={<div style={{ padding: 40, color: "var(--fg-muted)" }}>Loading…</div>}>
      <ExploreTabs stories={stories} />
    </Suspense>
  );
}
