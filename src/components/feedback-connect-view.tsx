'use client';

import React, { useState, useTransition } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Share2,
  ExternalLink,
  Sparkles,
  Braces,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/store';
import { showGuestNotice } from '@/components/auth/guest-notice';
import { NeubenchSpinner } from '@/components/loading';

const FEEDBACK_CATEGORIES = [
  { value: 'ui_ux', label: 'UI/UX improvement', desc: 'Design, layout, responsiveness, colors or navigation' },
  { value: 'bug', label: 'Bug report', desc: 'Broken links, visual glitches or unexpected errors' },
  { value: 'accuracy', label: 'Incorrect or misleading information', desc: 'Fact check, date error, wrong company or paper citation' },
  { value: 'quality', label: 'Article quality', desc: 'Summary clarity, significance depth or formatting' },
  { value: 'feature', label: 'Feature request', desc: 'New filters, metrics, integrations or capabilities' },
  { value: 'other', label: 'Other', desc: 'General thoughts or questions' },
];

interface FeedbackConnectMainViewProps {
  onBrowseLatest: () => void;
}

export function FeedbackConnectMainView({ onBrowseLatest }: FeedbackConnectMainViewProps) {
  const [category, setCategory] = useState('ui_ux');
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [, startTransition] = useTransition();
  const { status: authStatus, user: authUser } = useAuth();

  const githubUrl = 'https://github.com/baaghbdsk-bit/ainews';
  const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com';
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'gvivek982+signalaifeed@gmail.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authStatus !== 'signed-in' || !authUser) {
      if (authStatus === 'guest') showGuestNotice('Sign in to send feedback.');
      return;
    }
    if (comment.trim().length < 3) {
      setErrorMessage('Please provide a brief description (at least 3 characters).');
      setStatus('error');
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address, or leave the field empty.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          comment: comment.trim(),
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
          metadata: {
            url: typeof window !== 'undefined' ? window.location.href : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to submit feedback.');
      }

      startTransition(() => {
        setStatus('success');
        setComment('');
        setEmail('');
      });
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    }
  };

  return (
    <div className="feedback-connect-dossier" aria-label="Feedback & Connect Center">
      {/* Bespoke Editorial Hero for Feedback & Connect */}
      <header className="connect-custom-hero" aria-label="About Feedback & Connect">
        <div className="connect-custom-kicker">
          <Mail size={13} className="connect-kicker-icon" />
          <span>Community & Frontier Dispatch</span>
        </div>
        <h1 className="connect-custom-title">
          Shape the radar. <span className="connect-custom-title-gradient">Submit & Connect.</span>
        </h1>
        <p className="connect-custom-lede">
          NeuBench is an open, community-refined intelligence index. Report zero-day model releases, flag dataset corrections, propose empirical benchmarks, or connect with our editorial engineering team.
        </p>

        <div className="connect-custom-tags" aria-label="Participation channels">
          <span className="connect-custom-tag">
            <span className="connect-tag-bullet bullet-feedback" />
            Direct Bug & UI Reports
          </span>
          <span className="connect-custom-tag">
            <span className="connect-tag-bullet bullet-model" />
            Model Inclusion Requests
          </span>
          <span className="connect-custom-tag">
            <span className="connect-tag-bullet bullet-open" />
            Open Source GitHub Repository
          </span>
          <span className="connect-custom-tag">
            <span className="connect-tag-bullet bullet-editorial" />
            Direct Engineering Inquiries
          </span>
        </div>
      </header>

      {/* Grid: Feedback Form (Left/Top) & Official Channels (Right/Bottom) */}
      <div className="feedback-connect-grid">
        {/* Section A: Interactive Feedback Console */}
        <section className="feedback-console-card">
          <div className="console-head">
            <div className="section-badge">Direct Line</div>
            <h3 className="console-title">Interactive Feedback</h3>
            <p className="console-subtitle">
              Your feedback directly shapes NeuBench&apos;s curation pipeline, UI design, and feature roadmap.
            </p>
          </div>

          {status === 'success' ? (
            <div className="feedback-success-card" role="alert">
              <CheckCircle2 size={32} className="text-emerald-400" />
              <h4>Feedback Received!</h4>
              <p>Thank you for helping us improve NeuBench. Your feedback has been securely stored in our telemetry queue.</p>
              <button
                type="button"
                className="hero-action-btn btn-primary"
                onClick={() => setStatus('idle')}
              >
                Submit Additional Feedback
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="feedback-full-form">
              <div className="form-group">
                <label htmlFor="fc-category" className="form-label">
                  Choose Feedback Category
                </label>
                <div className="category-chips-grid">
                  {FEEDBACK_CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat.value}
                      className={`category-chip-btn ${category === cat.value ? 'is-selected' : ''}`}
                      onClick={() => setCategory(cat.value)}
                    >
                      <span className="category-chip-title">{cat.label}</span>
                      <span className="category-chip-desc">{cat.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="fc-email" className="form-label">
                  Your Email <span className="form-label-optional">(optional)</span>
                </label>
                <input
                  id="fc-email"
                  type="email"
                  className="feedback-input-email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === 'error') setErrorMessage('');
                  }}
                  disabled={status === 'submitting'}
                  autoComplete="email"
                  maxLength={254}
                />
                <span className="form-hint">Only used if we need to follow up. Never shared or sold.</span>
              </div>

              <div className="form-group">
                <label htmlFor="fc-comment" className="form-label">
                  Your Comments or Suggestions
                </label>
                <textarea
                  id="fc-comment"
                  className="feedback-textarea-large"
                  placeholder="Tell us what you think, what broke, or what features you would love to see..."
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (status === 'error') setErrorMessage('');
                  }}
                  disabled={status === 'submitting'}
                  rows={4}
                  maxLength={2000}
                  required
                />
                <div className="textarea-footer">
                  <span className="char-count">{comment.length} / 2000 characters</span>
                  <span className="privacy-note">
                    {email.trim() ? 'Your email is stored with this submission' : 'No personal data collected'}
                  </span>
                </div>
              </div>

              {status === 'error' && (
                <div className="feedback-error-banner" role="alert">
                  <AlertCircle size={15} />
                  <span>{errorMessage || 'Failed to submit feedback. Please try again.'}</span>
                </div>
              )}

              <button
                type="submit"
                className="feedback-submit-btn-large"
                disabled={status === 'submitting' || comment.trim().length < 3}
              >
                {status === 'submitting' ? (
                  <>
                    <NeubenchSpinner size={16} strokeWidth={5} />
                    <span>Submitting Feedback...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </form>
          )}
        </section>

        {/* Section B: Connect With Us Official Channels */}
        <section className="connect-channels-card">
          <div className="console-head">
            <div className="section-badge">Official Hubs</div>
            <h3 className="console-title">Connect With Us</h3>
            <p className="console-subtitle">
              Follow development updates, review our open codebase, or pull the data straight from the public API:
            </p>
          </div>

          <div className="channels-list">
            {/* GitHub */}
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="channel-card-link channel-github"
              title="View source repository on GitHub"
            >
              <div className="channel-icon-wrap">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>
              <div className="channel-info">
                <div className="channel-title-row">
                  <span className="channel-title">GitHub Repository</span>
                  <span className="channel-badge">Open Source</span>
                </div>
                <p className="channel-desc">
                  Inspect our Next.js codebase, report issues, and star our repository on GitHub.
                </p>
              </div>
              <ExternalLink size={15} className="channel-external-icon" />
            </a>

            {/* Instagram */}
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="channel-card-link channel-instagram"
              title="Follow NeuBench on Instagram"
            >
              <div className="channel-icon-wrap icon-instagram">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </div>
              <div className="channel-info">
                <div className="channel-title-row">
                  <span className="channel-title">Instagram Channel</span>
                  <span className="channel-badge">Visual Highlights</span>
                </div>
                <p className="channel-desc">
                  Daily milestone summaries, benchmark graphics, and frontier lab announcements.
                </p>
              </div>
              <ExternalLink size={15} className="channel-external-icon" />
            </a>

            {/* Email */}
            <a
              href={`mailto:${contactEmail}`}
              className="channel-card-link channel-email"
              title="Send NeuBench an email"
            >
              <div className="channel-icon-wrap icon-email">
                <Mail size={20} />
              </div>
              <div className="channel-info">
                <div className="channel-title-row">
                  <span className="channel-title">Email Us</span>
                  <span className="channel-badge">Direct Line</span>
                </div>
                <p className="channel-desc">
                  Send corrections, story tips, research leads, and partnership enquiries straight to the desk.
                </p>
              </div>
              <ExternalLink size={15} className="channel-external-icon" />
            </a>

            {/* Public data feed */}
            <a
              href="/api/stories"
              target="_blank"
              rel="noopener noreferrer"
              className="channel-card-link channel-api"
              title="Open the public stories API"
            >
              <div className="channel-icon-wrap icon-api">
                <Braces size={20} />
              </div>
              <div className="channel-info">
                <div className="channel-title-row">
                  <span className="channel-title">Public Data API</span>
                  <span className="channel-badge">Open Access</span>
                </div>
                <p className="channel-desc">
                  Paginated JSON feed of every story, filterable by topic, year, company, and free-text search.
                </p>
              </div>
              <ExternalLink size={15} className="channel-external-icon" />
            </a>
          </div>

          <div className="community-manifesto-box">
            <Share2 size={16} className="text-violet-400 flex-shrink-0" />
            <p>
              NeuBench operates with <strong>zero sponsored inclusions</strong> and <strong>zero algorithmic engagement traps</strong>. Every ranking is driven by verifiable benchmarks and open citations.
            </p>
          </div>
        </section>
      </div>

      {/* Return to Live Stream */}
      <div className="dossier-footer-nav" style={{ marginTop: '28px' }}>
        <button type="button" className="hero-action-btn btn-primary" onClick={onBrowseLatest}>
          <Sparkles size={14} />
          <span>Return to Live Stream</span>
        </button>
      </div>
    </div>
  );
}
