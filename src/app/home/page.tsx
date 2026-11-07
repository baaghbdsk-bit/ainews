import type { Metadata } from "next";
import { HomeLauncher } from "@/components/home-launcher";

export const metadata: Metadata = {
  title: "NeuBench — The One-Stop AI News Platform",
  description:
    "Get all your artificial intelligence news in one place. Real-time shifts, model launches, research breakthroughs, and executive highlights — never check 10 different sites again.",
  alternates: { canonical: "/home" },
  openGraph: {
    title: "NeuBench — The One-Stop AI News Platform",
    description:
      "All artificial intelligence news, breakthroughs, and model releases in one place. The living pulse of AI without checking 10 different sites.",
  },
};

export default function HomePage() {
  return <HomeLauncher />;
}
