'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { FeedbackFeed, FeedbackRow } from '@/lib/admin/feedback';

const CATEGORIES = [
  { id: 'bug', label: 'Bug', tone: 'rose' },
  { id: 'accuracy', label: 'Accuracy', tone: 'amber' },
  { id: 'quality', label: 'Quality', tone: 'violet' },
  { id: 'ui_ux', label: 'UI & UX', tone: 'sky' },
  { id: 'feature', label: 'Feature', tone: 'emerald' },
  { id: 'other', label: 'Other', tone: 'slate' },
] as const;

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deterministic UTC label, so server and client render identical text. */
function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function metadataEntries(value: unknown): Array<[string, string]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .slice(0, 12)
    .map(([key, entry]) => [
      key,
      typeof entry === 'string' ? entry : JSON.stringify(entry, null, 0) ?? String(entry),
    ]);
}

export function AdminFeedbackClient({
  feed,
  reviewerEmail,
}: {
  feed: FeedbackFeed;
  reviewerEmail: string;
}) {
  const { submissions, generatedAt, warning } = feed;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const now = useMemo(() => new Date(generatedAt).getTime(), [generatedAt]);

  const stats = useMemo(() => {
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const withEmail = submissions.filter((s) => !!s.email).length;
    const last7 = submissions.filter((s) => new Date(s.created_at).getTime() >= weekAgo).length;
    const perCategory = CATEGORIES.map((c) => ({
      ...c,
      count: submissions.filter((s) => s.category === c.id).length,
    }));
    const top = [...perCategory].sort((a, b) => b.count - a.count)[0];
    return { withEmail, last7, perCategory, top };
  }, [submissions, now]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = submissions.filter((row) => {
      if (category !== 'all' && row.category !== category) return false;
      if (onlyWithEmail && !row.email) return false;
      if (!needle) return true;
      const haystack = [
        row.comment,
        row.email ?? '',
        row.category,
        row.id,
        row.client_id ?? '',
        JSON.stringify(row.metadata ?? {}),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
    return rows.sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return newestFirst ? diff : -diff;
    });
  }, [submissions, search, category, onlyWithEmail, newestFirst]);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      setCopied(null);
    }
  };

  const refresh = () => startTransition(() => router.refresh());

  return (
    <section aria-labelledby="admin-title">
      <header className="admin-hero">
        <div>
          <span className="admin-kicker">
            <ShieldCheck size={13} />
            Admin console
          </span>
          <h1 id="admin-title" className="admin-title">
            Reader feedback
          </h1>
          <p className="admin-subtitle">
            Every note, bug report, and accuracy flag submitted from the timeline. Signed in as{' '}
            <strong>{reviewerEmail}</strong>.
          </p>
        </div>
        <button
          type="button"
          className={`admin-refresh${pending ? ' is-pending' : ''}`}
          onClick={refresh}
          disabled={pending}
        >
          <RefreshCw size={14} className={pending ? 'animate-spin' : undefined} />
          <span>{pending ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </header>

      {warning ? (
        <div className="admin-warning" role="status">
          <AlertCircle size={15} />
          <span>{warning}</span>
        </div>
      ) : null}

      <div className="admin-stats">
        <article className="admin-stat">
          <span className="admin-stat-label">Total submissions</span>
          <strong className="admin-stat-value">{submissions.length}</strong>
          <span className="admin-stat-note">Newest 500 retained</span>
        </article>
        <article className="admin-stat">
          <span className="admin-stat-label">Last 7 days</span>
          <strong className="admin-stat-value">{stats.last7}</strong>
          <span className="admin-stat-note">Rolling week, UTC</span>
        </article>
        <article className="admin-stat">
          <span className="admin-stat-label">Reply address</span>
          <strong className="admin-stat-value">{stats.withEmail}</strong>
          <span className="admin-stat-note">Readers open to a follow-up</span>
        </article>
        <article className="admin-stat">
          <span className="admin-stat-label">Top category</span>
          <strong className="admin-stat-value admin-stat-value-sm">
            {stats.top && stats.top.count > 0 ? stats.top.label : 'None yet'}
          </strong>
          <span className="admin-stat-note">
            {stats.top && stats.top.count > 0 ? `${stats.top.count} submissions` : 'No feedback to triage'}
          </span>
        </article>
      </div>

      <div className="admin-toolbar">
        <label className="admin-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search comments, email, ID, or context..."
            aria-label="Search feedback"
          />
          {search ? (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
              <X size={14} />
            </button>
          ) : null}
        </label>

        <button
          type="button"
          className={`admin-filter-toggle${onlyWithEmail ? ' is-active' : ''}`}
          onClick={() => setOnlyWithEmail((v) => !v)}
          aria-pressed={onlyWithEmail}
        >
          <Mail size={14} />
          <span>Email only</span>
        </button>

        <button
          type="button"
          className="admin-sort"
          onClick={() => setNewestFirst((v) => !v)}
          title="Toggle sort order"
        >
          <span>{newestFirst ? 'Newest first' : 'Oldest first'}</span>
          <ChevronDown size={14} className={newestFirst ? undefined : 'is-flipped'} />
        </button>
      </div>

      <div className="admin-categories" role="tablist" aria-label="Filter by category">
        <button
          type="button"
          role="tab"
          aria-selected={category === 'all'}
          className={`admin-category${category === 'all' ? ' is-active' : ''}`}
          onClick={() => setCategory('all')}
        >
          All
          <span className="admin-category-count">{submissions.length}</span>
        </button>
        {stats.perCategory.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            className={`admin-category admin-tone-${c.tone}${category === c.id ? ' is-active' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
            <span className="admin-category-count">{c.count}</span>
          </button>
        ))}
      </div>

      <div className="admin-list-head">
        <span>
          Showing <strong>{filtered.length}</strong> of {submissions.length}
        </span>
        <span className="admin-generated">Snapshot {formatUtc(generatedAt)}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="admin-empty">
          <MessageSquare size={22} />
          <h2>{submissions.length ? 'No feedback matches these filters' : 'No feedback yet'}</h2>
          <p>
            {submissions.length
              ? 'Try clearing the search or choosing a different category.'
              : 'When a signed-in reader sends a note from the Feedback view, it will appear here.'}
          </p>
        </div>
      ) : (
        <ol className="admin-feedback-list">
          {filtered.map((row) => (
            <FeedbackCard
              key={row.id}
              row={row}
              copied={copied}
              onCopy={copy}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function FeedbackCard({
  row,
  copied,
  onCopy,
}: {
  row: FeedbackRow;
  copied: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  const meta = CATEGORY_BY_ID.get(row.category as (typeof CATEGORIES)[number]['id']);
  const tone = meta?.tone ?? 'slate';
  const label = meta?.label ?? row.category;
  const context = metadataEntries(row.metadata);

  return (
    <li className={`admin-feedback admin-feedback-${tone}`}>
      <div className="admin-feedback-top">
        <span className={`admin-badge admin-badge-${tone}`}>{label}</span>
        <time dateTime={row.created_at}>{formatUtc(row.created_at)}</time>
        <span className="admin-feedback-id" title={row.id}>
          #{shortId(row.id)}
        </span>
      </div>

      <p className="admin-feedback-comment">{row.comment}</p>

      <div className="admin-feedback-foot">
        {row.email ? (
          <a
            className="admin-mail"
            href={`mailto:${row.email}?subject=${encodeURIComponent('Re: your NeuBench feedback')}`}
          >
            <Mail size={13} />
            <span>{row.email}</span>
          </a>
        ) : (
          <span className="admin-muted">No reply address</span>
        )}

        <div className="admin-feedback-actions">
          {row.email ? (
            <button
              type="button"
              className="admin-ghost-btn"
              onClick={() => onCopy(`email-${row.id}`, row.email!)}
            >
              {copied === `email-${row.id}` ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              <span>{copied === `email-${row.id}` ? 'Copied' : 'Copy email'}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="admin-ghost-btn"
            onClick={() => onCopy(`id-${row.id}`, row.id)}
          >
            {copied === `id-${row.id}` ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            <span>{copied === `id-${row.id}` ? 'Copied' : 'Copy ID'}</span>
          </button>
        </div>
      </div>

      {context.length ? (
        <details className="admin-feedback-details">
          <summary>Context ({context.length})</summary>
          <dl>
            {context.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}

      {row.client_id ? (
        <span className="admin-client" title={row.client_id}>
          Client {row.client_id.slice(0, 12)}
        </span>
      ) : null}
    </li>
  );
}

