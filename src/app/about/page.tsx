import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreTabs } from "@/components/explore-tabs";
import { NeubenchLoadingLogo } from "@/components/loading";

export const metadata: Metadata = {
  title: "About NeuBench — The One-Stop AI News Platform",
  description:
    "NeuBench is the one-stop platform unifying artificial intelligence news, research breakthroughs, model architectures, and frontier evaluations in a single live timeline.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About NeuBench — The One-Stop AI News Platform",
    description:
      "A living index and real-time news radar documenting every pivotal release, breakthrough, and shift shaping the future of AI.",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <Suspense fallback={<NeubenchLoadingLogo variant="fullscreen" size={56} label="Loading About…" />}>
      <ExploreTabs initialView="about" stories={[]} />
    </Suspense>
  );
}
