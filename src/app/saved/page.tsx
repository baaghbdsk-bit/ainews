import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreTabs } from "@/components/explore-tabs";
import { NeubenchLoadingLogo } from "@/components/loading";

export const metadata: Metadata = {
  title: "Saved Intelligence Dossier — NeuBench",
  description:
    "Your curated collection of bookmarked AI dispatches, research breakthroughs, and model announcements.",
  alternates: {
    canonical: "/saved",
  },
  openGraph: {
    title: "Saved Intelligence Dossier — NeuBench",
    description: "Your personal intelligence dossier, synced across devices.",
    type: "website",
  },
};

export default function SavedPage() {
  return (
    <Suspense fallback={<NeubenchLoadingLogo variant="fullscreen" size={56} label="Loading Saved Stories…" />}>
      <ExploreTabs initialView="saved" stories={[]} />
    </Suspense>
  );
}
