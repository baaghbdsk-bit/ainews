import type { Metadata } from "next";
import { HomeLauncher } from "@/components/home-launcher";

export const metadata: Metadata = {
  alternates: { canonical: "/home" },
};

export default function HomePage() {
  return <HomeLauncher />;
}
