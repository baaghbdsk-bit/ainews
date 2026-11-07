import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreTabs } from "@/components/explore-tabs";
import { NeubenchLoadingLogo } from "@/components/loading";

export const metadata: Metadata = {
  title: "Feedback & Connect — NeuBench",
  description:
    "Share feedback, report bugs, connect with the NeuBench engineering team, and shape the future of AI news intelligence.",
  alternates: {
    canonical: "/feedback",
  },
  openGraph: {
    title: "Feedback & Connect — NeuBench",
    description: "Channels to reach the team and shape the product.",
    type: "website",
  },
};

export default function FeedbackPage() {
  return (
    <Suspense fallback={<NeubenchLoadingLogo variant="fullscreen" size={56} label="Loading Feedback & Connect…" />}>
      <ExploreTabs initialView="connect" stories={[]} />
    </Suspense>
  );
}
