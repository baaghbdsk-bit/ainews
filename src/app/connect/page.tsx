import { Metadata } from "next";
import { ExploreTabs } from "@/components/explore-tabs";

export const metadata: Metadata = {
  title: "Connect | NeuBench AI",
  description: "Connect with the NeuBench AI team, submit feedback, inspect our API, and contribute to the open benchmark intelligence catalog.",
};

export const dynamic = "force-static";

export default function ConnectPage() {
  return <ExploreTabs initialView="connect" stories={[]} />;
}
