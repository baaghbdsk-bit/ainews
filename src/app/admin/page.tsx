import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/app/site-header";
import { isAdmin } from "@/lib/auth/editor";
import { getSessionUser } from "@/lib/auth/session-server";
import { getFeedbackFeed } from "@/lib/admin/feedback";
import { getAdminUsersList } from "@/lib/admin/users";
import { AdminDashboardClient } from "./dashboard-client";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin console",
  description: "Admin-only console for NeuBench.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) notFound();

  const [feed, initialUsers] = await Promise.all([
    getFeedbackFeed(),
    getAdminUsersList(),
  ]);

  return (
    <main className="site-frame archive-page admin-page">
      <SiteHeader className="story-article-topbar" />
      <AdminDashboardClient
        feed={feed}
        initialUsers={initialUsers}
        reviewerEmail={user.email ?? "admin"}
      />
    </main>
  );
}
