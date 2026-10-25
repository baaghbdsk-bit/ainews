import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/app/site-header";
import { isAdmin } from "@/lib/auth/editor";
import { getSessionUser } from "@/lib/auth/session-server";
import { getFeedbackFeed } from "@/lib/admin/feedback";
import { AdminDashboardClient } from "./dashboard-client";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin console",
  description: "Admin-only console for NeuBench.",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) notFound();

  const feed = await getFeedbackFeed();

  return (
    <main className="site-frame archive-page admin-page">
      <SiteHeader
        className="story-article-topbar"
        right={
          <div className="header-actions">
            <Link className="story-back-link" href="/">
              <ArrowLeft size={16} />
              <span>Back to timeline</span>
            </Link>
          </div>
        }
      />
      <AdminDashboardClient feed={feed} reviewerEmail={user.email ?? "admin"} />
    </main>
  );
}
