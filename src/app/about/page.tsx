import type { Metadata } from "next";
import { SiteHeader } from "@/app/site-header";
import { AboutMainView } from "@/components/views-about";

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
    <main className="site-frame archive-page">
      <SiteHeader className="story-article-topbar" />
      <AboutMainView />
    </main>
  );
}
