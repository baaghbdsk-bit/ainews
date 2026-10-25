'use client';

import React, { useState } from 'react';
import { AdminFeedbackClient } from './admin-client';
import { NewsReviewClient } from './news-review-client';
import type { FeedbackFeed } from '@/lib/admin/feedback';

export function AdminDashboardClient({
  feed,
  reviewerEmail,
}: {
  feed: FeedbackFeed;
  reviewerEmail: string;
}) {
  const [tab, setTab] = useState<'feedback' | 'news-review'>('feedback');

  return (
    <div className="admin-shell">
      <div className="admin-dashboard-tabs" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'feedback'}
          className={`admin-dashboard-tab${tab === 'feedback' ? ' is-active' : ''}`}
          onClick={() => setTab('feedback')}
        >
          Feedback inbox
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'news-review'}
          className={`admin-dashboard-tab${tab === 'news-review' ? ' is-active' : ''}`}
          onClick={() => setTab('news-review')}
        >
          News review
        </button>
      </div>

      {tab === 'feedback' ? (
        <AdminFeedbackClient feed={feed} reviewerEmail={reviewerEmail} />
      ) : (
        <NewsReviewClient />
      )}
    </div>
  );
}

