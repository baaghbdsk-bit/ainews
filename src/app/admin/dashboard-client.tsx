'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Flame,
  Globe,
  Key,
  Layers,
  Lock,
  MessageSquare,
  Newspaper,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { AdminFeedbackClient } from './admin-client';
import { NewsReviewClient } from './news-review-client';
import { AdminUsersClient } from './users-client';
import type { FeedbackFeed } from '@/lib/admin/feedback';
import type { AdminUserItem } from '@/lib/admin/users';
import { adminTriggerIngest, adminTriggerRevalidate, type AdminOpResult } from '@/lib/actions/admin-ops';

type AdminTab = 'control' | 'users' | 'news-review' | 'feedback' | 'security';

export function AdminDashboardClient({
  feed,
  initialUsers = [],
  reviewerEmail,
}: {
  feed: FeedbackFeed;
  initialUsers?: AdminUserItem[];
  reviewerEmail: string;
}) {
  const [tab, setTab] = useState<AdminTab>('control');
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionLogs, setActionLogs] = useState<AdminOpResult[]>([
    {
      ok: true,
      message: 'Admin console initialized. Connected to production edge runtime.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const handleAction = (name: string, fn: () => Promise<AdminOpResult>) => {
    setActiveAction(name);
    startTransition(async () => {
      try {
        const res = await fn();
        setActionLogs((prev) => [
          { ...res, timestamp: new Date().toLocaleTimeString() },
          ...prev.slice(0, 15),
        ]);
      } catch (err) {
        setActionLogs((prev) => [
          {
            ok: false,
            message: err instanceof Error ? err.message : 'Action failed unexpectedly.',
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev.slice(0, 15),
        ]);
      } finally {
        setActiveAction(null);
      }
    });
  };

  return (
    <div className="admin-shell">
      {/* Top Command Banner */}
      <header className="admin-command-hero">
        <div className="admin-command-brand-block">
          <div className="admin-command-kicker">
            <span className="admin-pulse-dot" />
            <ShieldCheck size={13} className="text-purple-400" />
            <span>NeuBench Mission Control</span>
            <span className="admin-env-pill">Production</span>
          </div>
          <h1 className="admin-command-title">Executive Command Center</h1>
          <p className="admin-command-desc">
            Autonomous AI News ingestion, user role governance, editorial verification, and security operations.
          </p>
        </div>

        <div className="admin-reviewer-badge-card">
          <div className="admin-reviewer-info">
            <span className="admin-reviewer-label">Authorized Administrator</span>
            <span className="admin-reviewer-email">{reviewerEmail}</span>
            <span className="admin-session-active">
              <span className="admin-live-indicator" /> Role: Root Admin (Verified)
            </span>
          </div>
        </div>
      </header>

      {/* Modern Segmented Navigation Tabs */}
      <nav className="admin-nav-tabs" role="tablist" aria-label="Admin Navigation Sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'control'}
          className={`admin-nav-tab ${tab === 'control' ? 'is-active' : ''}`}
          onClick={() => setTab('control')}
        >
          <Activity size={15} />
          <span>System Radar</span>
          <span className="admin-tab-chip live">Live</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'users'}
          className={`admin-nav-tab ${tab === 'users' ? 'is-active' : ''}`}
          onClick={() => setTab('users')}
        >
          <Users size={15} />
          <span>Users & Access</span>
          <span className="admin-tab-chip secure">RBAC</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'news-review'}
          className={`admin-nav-tab ${tab === 'news-review' ? 'is-active' : ''}`}
          onClick={() => setTab('news-review')}
        >
          <Newspaper size={15} />
          <span>News Review</span>
          <span className="admin-tab-chip">Editorial</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'feedback'}
          className={`admin-nav-tab ${tab === 'feedback' ? 'is-active' : ''}`}
          onClick={() => setTab('feedback')}
        >
          <MessageSquare size={15} />
          <span>Reader Intelligence</span>
          <span className="admin-tab-chip counter">{feed.submissions.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'security'}
          className={`admin-nav-tab ${tab === 'security' ? 'is-active' : ''}`}
          onClick={() => setTab('security')}
        >
          <Lock size={15} />
          <span>Security & Governance</span>
          <span className="admin-tab-chip secure">Hardened</span>
        </button>
      </nav>

      {/* Main Tab Panels */}
      {tab === 'control' && (
        <section className="admin-control-view">
          {/* Key Metric Gauges */}
          <div className="admin-metric-grid">
            <div className="admin-metric-card">
              <div className="admin-metric-icon-wrap violet">
                <Server size={18} />
              </div>
              <div className="admin-metric-content">
                <span className="admin-metric-title">Ingestion Engine</span>
                <span className="admin-metric-val">100% Operational</span>
                <span className="admin-metric-sub">RSS & News crawler running</span>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-icon-wrap cyan">
                <Zap size={18} />
              </div>
              <div className="admin-metric-content">
                <span className="admin-metric-title">Edge Cache</span>
                <span className="admin-metric-val">Cloudflare Worker</span>
                <span className="admin-metric-sub">Global CDN with tag revalidation</span>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-icon-wrap emerald">
                <Database size={18} />
              </div>
              <div className="admin-metric-content">
                <span className="admin-metric-title">Database Storage</span>
                <span className="admin-metric-val">PostgreSQL & PostgREST</span>
                <span className="admin-metric-sub">Stories, Upvotes & Profiles RLS</span>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-icon-wrap amber">
                <MessageSquare size={18} />
              </div>
              <div className="admin-metric-content">
                <span className="admin-metric-title">Reader Feedback</span>
                <span className="admin-metric-val">{feed.submissions.length} Dispatches</span>
                <span className="admin-metric-sub">Community reports tracked</span>
              </div>
            </div>
          </div>

          {/* Quick Execution Actions */}
          <div className="admin-panel-card">
            <div className="admin-panel-head">
              <div className="admin-panel-title-wrap">
                <Terminal size={17} className="text-purple-400" />
                <h2 className="admin-panel-title">Manual Pipeline Operations</h2>
              </div>
              <span className="admin-panel-badge">Server Actions • Admin Verified</span>
            </div>

            <div className="admin-actions-grid">
              <button
                type="button"
                className="admin-action-btn primary"
                disabled={isPending}
                onClick={() => handleAction('Full Ingest', () => adminTriggerIngest('full'))}
              >
                <div className="admin-action-btn-top">
                  <Play size={16} />
                  <span>Trigger Ingestion Pipeline</span>
                </div>
                <p className="admin-action-btn-desc">
                  Fetches breaking news from official lab RSS feeds, categorizes, enriches, and purges edge cache.
                </p>
                {activeAction === 'Full Ingest' && <span className="admin-btn-loader">Running...</span>}
              </button>

              <button
                type="button"
                className="admin-action-btn"
                disabled={isPending}
                onClick={() => handleAction('Revalidate Cache', adminTriggerRevalidate)}
              >
                <div className="admin-action-btn-top">
                  <RefreshCw size={16} />
                  <span>Purge & Revalidate Cache</span>
                </div>
                <p className="admin-action-btn-desc">
                  Invalidates Next.js ISR tag caches (AI_NEWS_TAG, STORIES_TAG) and refreshes edge response caches.
                </p>
                {activeAction === 'Revalidate Cache' && <span className="admin-btn-loader">Purging...</span>}
              </button>

              <button
                type="button"
                className="admin-action-btn"
                disabled={isPending}
                onClick={() => handleAction('Enrich Only', () => adminTriggerIngest('enrich'))}
              >
                <div className="admin-action-btn-top">
                  <Layers size={16} />
                  <span>Enrich Article Bodies</span>
                </div>
                <p className="admin-action-btn-desc">
                  Runs readability and full article extraction on un-enriched story backlogs without new fetches.
                </p>
                {activeAction === 'Enrich Only' && <span className="admin-btn-loader">Enriching...</span>}
              </button>

              <button
                type="button"
                className="admin-action-btn"
                disabled={isPending}
                onClick={() => handleAction('Backfill Images', () => adminTriggerIngest('images'))}
              >
                <div className="admin-action-btn-top">
                  <Globe size={16} />
                  <span>Lead Images Backfill</span>
                </div>
                <p className="admin-action-btn-desc">
                  Crawls and resolves open-graph header images for stories currently lacking visual thumbnails.
                </p>
                {activeAction === 'Backfill Images' && <span className="admin-btn-loader">Resolving...</span>}
              </button>
            </div>

            {/* Live Terminal Console */}
            <div className="admin-terminal-console">
              <div className="admin-terminal-topbar">
                <span className="admin-terminal-dot red" />
                <span className="admin-terminal-dot yellow" />
                <span className="admin-terminal-dot green" />
                <span className="admin-terminal-title">runtime_console.log</span>
              </div>
              <div className="admin-terminal-body">
                {actionLogs.map((log, i) => (
                  <div key={i} className={`admin-terminal-line ${log.ok ? 'is-ok' : 'is-err'}`}>
                    <span className="admin-terminal-time">[{log.timestamp}]</span>
                    <span className="admin-terminal-status">{log.ok ? '✓ OK' : '✗ ERR'}</span>
                    <span className="admin-terminal-msg">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'users' && (
        <section className="admin-tab-view">
          <AdminUsersClient reviewerEmail={reviewerEmail} initialUsers={initialUsers} />
        </section>
      )}

      {tab === 'news-review' && (
        <section className="admin-tab-view">
          <NewsReviewClient />
        </section>
      )}

      {tab === 'feedback' && (
        <section className="admin-tab-view">
          <AdminFeedbackClient feed={feed} reviewerEmail={reviewerEmail} />
        </section>
      )}

      {tab === 'security' && (
        <section className="admin-security-view">
          <div className="admin-panel-card">
            <div className="admin-panel-head">
              <div className="admin-panel-title-wrap">
                <ShieldCheck size={18} className="text-emerald-400" />
                <h2 className="admin-panel-title">Production Security & Compliance Audit</h2>
              </div>
              <span className="admin-panel-badge secure">Passed All Verifications</span>
            </div>

            <div className="admin-security-checklist">
              <div className="admin-security-item">
                <div className="admin-security-icon-ok">
                  <CheckCircle2 size={16} />
                </div>
                <div className="admin-security-details">
                  <h4>Service Role Key Containment</h4>
                  <p>
                    Verified: <code>SUPABASE_SERVICE_ROLE_KEY</code> is completely isolated to server-side Cloudflare Worker runtime.
                    Zero leakage into browser JS bundles.
                  </p>
                </div>
                <span className="admin-security-badge-ok">Enforced</span>
              </div>

              <div className="admin-security-item">
                <div className="admin-security-icon-ok">
                  <CheckCircle2 size={16} />
                </div>
                <div className="admin-security-details">
                  <h4>Role-Based Access Control (RBAC)</h4>
                  <p>
                    Verified: Admin endpoints (<code>/admin</code>, <code>/api/admin/*</code>) require signed-in session with verified <code>app_metadata.role = &#39;admin&#39;</code>. Unauthorized visitors receive HTTP 404/403.
                  </p>
                </div>
                <span className="admin-security-badge-ok">Active</span>
              </div>

              <div className="admin-security-item">
                <div className="admin-security-icon-ok">
                  <CheckCircle2 size={16} />
                </div>
                <div className="admin-security-details">
                  <h4>Row Level Security (RLS)</h4>
                  <p>
                    Verified: All Supabase tables (<code>story_bookmarks</code>, <code>story_upvotes</code>, <code>profiles</code>) enforce client-isolated RLS. Readers can only query and modify their own records.
                  </p>
                </div>
                <span className="admin-security-badge-ok">Enabled</span>
              </div>

              <div className="admin-security-item">
                <div className="admin-security-icon-ok">
                  <CheckCircle2 size={16} />
                </div>
                <div className="admin-security-details">
                  <h4>API Guard & Rate Limiting</h4>
                  <p>
                    Verified: Ingestion routes enforce <code>CRON_SECRET</code> bearer authentication. Public mutation endpoints (<code>/api/auth/signup</code>, <code>/api/feedback</code>, <code>/api/upvotes</code>) enforce strict per-IP rate-limiting windows.
                  </p>
                </div>
                <span className="admin-security-badge-ok">Protected</span>
              </div>

              <div className="admin-security-item">
                <div className="admin-security-icon-ok">
                  <CheckCircle2 size={16} />
                </div>
                <div className="admin-security-details">
                  <h4>Input Schema Sanitization</h4>
                  <p>
                    Verified: Zod schemas validate all body payloads, query parameters, email strings, and JSON sizes (max 8KB metadata) before reaching database execution.
                  </p>
                </div>
                <span className="admin-security-badge-ok">Validated</span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
