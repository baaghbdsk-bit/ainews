'use client';

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Search,
} from 'lucide-react';
import type { NewsReviewCandidate, NewsReviewStatus } from '@/lib/admin/news-review';

interface FeedResponse {
  candidates: NewsReviewCandidate[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<NewsReviewStatus | 'all', number>;
  generatedAt: string;
  warning: string | null;
}

const STATUS_TABS: Array<{ id: NewsReviewStatus | 'all'; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'deferred', label: 'Deferred' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'all', label: 'All' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusTone(status: string): string {
  switch (status) {
    case 'approved':
      return 'emerald';
    case 'rejected':
      return 'rose';
    case 'deferred':
      return 'amber';
    case 'duplicate':
      return 'slate';
    default:
      return 'violet';
  }
}

export function NewsReviewClient() {
  const [status, setStatus] = useState<NewsReviewStatus | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [duplicateDraft, setDuplicateDraft] = useState<Record<string, string>>({});
  const [showDuplicateFor, setShowDuplicateFor] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', status);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page', String(page));
      params.set('pageSize', '25');
      const res = await fetch(`/api/news-review?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as FeedResponse;
      setFeed(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the review queue.');
    } finally {
      setLoading(false);
    }
  }, [status, debouncedSearch, page]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const runAction = useCallback(
    async (id: string, action: 'approve' | 'reject' | 'defer' | 'duplicate', reason?: string, duplicateOf?: string) => {
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch('/api/news-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action, reason, duplicateOf }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        setSuccess(
          action === 'approve'
            ? 'Candidate approved for the publishing workflow.'
            : action === 'reject'
              ? 'Candidate rejected.'
              : action === 'defer'
                ? 'Candidate deferred.'
                : 'Candidate marked as duplicate.',
        );
        setShowDuplicateFor(null);
        startTransition(() => {
          void load();
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed.');
      }
    },
    [load],
  );

  const totalPages = useMemo(() => {
    if (!feed) return 1;
    return Math.max(1, Math.ceil(feed.total / feed.pageSize));
  }, [feed]);

  const pendingCount = feed?.counts.pending ?? 0;

  return (
    <section className="admin-news-review" aria-label="News review queue">
      <div className="admin-news-review-head">
        <div>
          <h2 className="admin-news-review-title">News review queue</h2>
          <p className="admin-news-review-subtitle">
            Held discovery candidates awaiting human review. Approval marks a candidate
            eligible for the publishing workflow; it does not publish directly.
          </p>
        </div>
        <div className="admin-news-review-pending" aria-live="polite">
          <span className="admin-news-review-pending-value">{pendingCount}</span>
          <span className="admin-news-review-pending-label">pending</span>
        </div>
      </div>

      {error ? (
        <div className="admin-warning" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div className="admin-success" role="status">
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      ) : null}
      {feed?.warning ? (
        <div className="admin-warning" role="status">
          <AlertCircle size={16} />
          <span>{feed.warning}</span>
        </div>
      ) : null}

      <div className="admin-news-review-toolbar">
        <div className="admin-news-review-tabs" role="tablist" aria-label="Review status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={status === tab.id}
              className={`admin-news-review-tab${status === tab.id ? ' is-active' : ''}`}
              onClick={() => { setStatus(tab.id); setPage(1); }}
            >
              {tab.label}
              {feed ? (
                <span className="admin-news-review-tab-count">
                  {tab.id === 'all' ? feed.counts.all : feed.counts[tab.id as NewsReviewStatus]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <label className="admin-news-review-search">
          <Search size={14} />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search headline or publisher"
            aria-label="Search news review queue"
          />
        </label>
      </div>

      {loading ? (
        <div className="admin-news-review-loading" role="status" aria-live="polite">
          <Loader2 size={18} className="admin-spin" />
          <span>Loading review queue…</span>
        </div>
      ) : feed && feed.candidates.length === 0 ? (
        <div className="admin-empty">
          <h2>No candidates in this view</h2>
          <p>
            {feed.total === 0
              ? 'The review queue is empty. Held discovery candidates will appear here once a pilot enqueues them.'
              : 'No candidates match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="admin-news-review-table-wrap">
          <table className="admin-news-review-table">
            <thead>
              <tr>
                <th>Headline / publisher</th>
                <th>Source</th>
                <th>Dates</th>
                <th>Hold reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(feed?.candidates ?? []).map((candidate) => {
                const tone = statusTone(candidate.review_status);
                return (
                  <tr key={candidate.id}>
                    <td>
                      <div className="admin-news-review-headline">{candidate.headline}</div>
                      <div className="admin-news-review-publisher">{candidate.publisher ?? 'Unknown publisher'}</div>
                      {candidate.reasons?.length ? (
                        <details className="admin-news-review-reasons">
                          <summary>Reasons ({candidate.reasons.length})</summary>
                          <ul>
                            {candidate.reasons.map((reason, index) => (
                              <li key={`${candidate.id}-reason-${index}`}>{reason}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </td>
                    <td>
                      {candidate.original_url ? (
                        <a
                          href={candidate.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-news-review-link"
                        >
                          Open source <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="admin-muted">No URL</span>
                      )}
                      {candidate.canonical_url ? (
                        <div className="admin-news-review-url" title={candidate.canonical_url}>
                          {candidate.canonical_url}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div>Published: {formatDate(candidate.published_at)}</div>
                      <div>Discovered: {formatDate(candidate.discovered_at)}</div>
                    </td>
                    <td>
                      <span className="admin-badge admin-badge-slate">{candidate.hold_reason ?? '—'}</span>
                      <div className="admin-news-review-validation">
                        Validation: {candidate.validation_status}
                      </div>
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge-${tone}`}>{candidate.review_status}</span>
                      {candidate.duplicate_of_slug ? (
                        <div className="admin-news-review-duplicate">
                          Duplicate of: {candidate.duplicate_of_slug}
                        </div>
                      ) : null}
                      {candidate.review_reason ? (
                        <div className="admin-news-review-review-reason">{candidate.review_reason}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="admin-news-review-actions">
                        <button
                          type="button"
                          className="admin-ghost-btn"
                          disabled={pending || candidate.review_status === 'approved'}
                          onClick={() => runAction(candidate.id, 'approve')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="admin-ghost-btn"
                          disabled={pending || candidate.review_status === 'rejected'}
                          onClick={() => {
                            const reason = window.prompt('Rejection reason (optional):') ?? '';
                            void runAction(candidate.id, 'reject', reason);
                          }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="admin-ghost-btn"
                          disabled={pending}
                          onClick={() => runAction(candidate.id, 'defer')}
                        >
                          Defer
                        </button>
                        <button
                          type="button"
                          className="admin-ghost-btn"
                          disabled={pending}
                          onClick={() => setShowDuplicateFor(candidate.id)}
                        >
                          Mark duplicate
                        </button>
                      </div>
                      {showDuplicateFor === candidate.id ? (
                        <div className="admin-news-review-duplicate-form">
                          <input
                            type="text"
                            value={duplicateDraft[candidate.id] ?? ''}
                            onChange={(e) =>
                              setDuplicateDraft((prev) => ({ ...prev, [candidate.id]: e.target.value }))
                            }
                            placeholder="Existing story slug"
                            aria-label="Existing story slug"
                          />
                          <button
                            type="button"
                            className="admin-ghost-btn"
                            disabled={pending || !(duplicateDraft[candidate.id] ?? '').trim()}
                            onClick={() =>
                              runAction(
                                candidate.id,
                                'duplicate',
                                'Marked as duplicate.',
                                duplicateDraft[candidate.id],
                              )
                            }
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="admin-ghost-btn"
                            onClick={() => setShowDuplicateFor(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {feed && feed.total > feed.pageSize ? (
        <div className="admin-news-review-pagination">
          <button
            type="button"
            className="admin-ghost-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="admin-ghost-btn"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      ) : null}
    </section>
  );
}

