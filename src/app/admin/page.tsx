import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/app/site-header';
import { isAdmin } from '@/lib/auth/editor';
import { getSessionUser } from '@/lib/auth/session-server';
import { getFeedbackFeed } from '@/lib/admin/feedback';
import { AdminFeedbackClient } from './admin-client';
import './admin.css';

export const metadata: Metadata = {
  title: 'Feedback inbox · NeuBench',
  description: 'Admin-only feedback inbox for NeuBench.',
  robots: { index: false, follow: false },
};

// The session check has to finish before the response starts, otherwise
// `notFound()` lands in a streamed Suspense hole and cannot set a 404 status.
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
      <AdminFeedbackClient feed={feed} reviewerEmail={user.email ?? 'admin'} />
    </main>
  );
}
