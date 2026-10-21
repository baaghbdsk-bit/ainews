import type { Metadata } from "next";
import { AboutClient } from "./about-client";

export const metadata: Metadata = {
  title: "About NeuBench — The Pulse of AI",
  description:
    "NeuBench is a living archive and radar for artificial intelligence breakthroughs, model architectures, foundational research, and global governance.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About NeuBench — Intelligence through time",
    description:
      "A living index documenting the pivotal releases, architectural leaps, and regulatory shifts shaping the future of AI.",
    type: "website",
  },
};

export default function AboutPage() {
  return <AboutClient />;
}

