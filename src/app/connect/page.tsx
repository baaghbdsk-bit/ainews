import type { Metadata } from "next";
import { SiteHeader } from "@/app/site-header";
import { FeedbackConnectMainView } from "@/components/feedback-connect-view";

export const metadata: Metadata = {
  title: "Connect | NeuBench AI",
  description: "Connect with the NeuBench AI team, submit feedback, inspect our API, and contribute to the open benchmark intelligence catalog.",
};

export default function ConnectPage() {
  return (
    <main className="site-frame archive-page">
      <SiteHeader className="story-article-topbar" />
      <FeedbackConnectMainView />
    </main>
  );
}
