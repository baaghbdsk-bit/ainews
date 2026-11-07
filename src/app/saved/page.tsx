import type { Metadata } from "next";
import { SiteHeader } from "@/app/site-header";
import { SavedStoriesView } from "@/components/saved-stories-view";

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
    <div className="site-frame archive-page">
      <SiteHeader className="story-article-topbar" />
      <SavedStoriesView />
    </div>
  );
}
