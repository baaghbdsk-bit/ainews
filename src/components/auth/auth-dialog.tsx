'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogIn,
  Mail,
  MailCheck,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth, startAuth } from '@/lib/auth/store';

type Mode = 'signin' | 'signup' | 'magic' | 'forgot';

const COPY = {
  signin: {
    title: 'Sign in',
    subtitle: 'Keep your votes and saved stories across every device.',
    cta: 'Sign in',
    switchTo: 'signup',
    switchLabel: 'Need an account?',
    switchCta: 'Create an account',
  },
  signup: {
    title: 'Create an account',
    subtitle: 'No email confirmation step. Your votes and saved stories follow you to any device.',
    cta: 'Create account',
    switchTo: 'signin',
    switchLabel: 'Already have an account?',
    switchCta: 'Sign in',
  },
  magic: {
    title: 'Email me a link',
    subtitle: 'No password needed. We will send you a sign-in link.',
    cta: 'Send the link',
    switchTo: 'signin',
    switchLabel: 'Use a password instead',
    switchCta: 'Sign in',
  },
  forgot: {
    title: 'Reset your password',
    subtitle: 'Enter the email on your account and we will send you a reset link.',
    cta: 'Send reset link',
    switchTo: 'signin',
    switchLabel: 'Remembered your password?',
    switchCta: 'Sign in',
  },
};

/**
 * The account dialog.
 *
 * A reader is never blocked by it: the app is fully usable without an
 * account, "Explore as guest" is one click, and the dialog never opens on its
 * own.
 */
export function AuthDialog() {
  const { authOpen, closeAuth } = useAuth();
  // Starting the session here keeps the page out of a client wrapper, which
  // is what lets a missing story still answer with a real 404.
  useEffect(() => {
    startAuth();
  }, []);
  if (!authOpen && !promptOpen) return null;
  // Mounted fresh each time it opens, so the form starts clean without a
  // reset effect.
  return (
    <>
      {authOpen && (
        <AuthDialogPanel
          onClose={closeAuth}
          onComplete={() => {
            // tour prompt removed
          }}
        />
      )}
      {promptOpen && (
        
      )}
    </>
  );
}

function AuthDialogPanel({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const { signIn, signUp, sendMagicLink, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Let the dialog paint before moving focus into it.
    const t = setTimeout(() => emailRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // The page behind the dialog must not scroll while it is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      // Keep Tab inside the dialog: it is modal, so focus must not wander to
      // the page behind it.
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = COPY[mode];

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setResetSent(false);
    setPassword('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        onClose();
        onComplete();
      } else if (mode === 'signup') {
        const result = await signUp(email.trim(), password);
        if (result.autoSignedIn) {
          onClose();
          onComplete();
        } else {
          setMode('signin');
          setPassword('');
          setNotice('Your account was created. Sign in below to continue.');
          setTimeout(() => document.getElementById('auth-password')?.focus(), 40);
        }
      } else if (mode === 'forgot') {
        await resetPassword(email.trim());
        setResetSent(true);
      } else {
        await sendMagicLink(email.trim());
        setNotice('Sign-in link sent. Check your inbox.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="auth-dialog" ref={dialogRef}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        <div className="auth-head">
          <span className="auth-kicker">
            <Sparkles size={12} />
            NeuBench account
          </span>
          <h2 id="auth-dialog-title" className="auth-title">
            {copy.title}
          </h2>
          <p className="auth-subtitle">{copy.subtitle}</p>
        </div>

        {notice && (
          <div className="auth-notice" role="status">
            <CheckCircle2 size={14} />
            <span>{notice}</span>
          </div>
        )}

        {mode === 'forgot' && resetSent ? (
          <div className="auth-sent" role="status">
            <span className="auth-sent-icon">
              <MailCheck size={20} />
            </span>
            <h3 className="auth-sent-title">Check your email</h3>
            <p className="auth-sent-text">
              If an account exists for <strong>{email}</strong>, a reset link is on
              its way. The link works once and expires shortly.
            </p>
            <button type="button" className="auth-submit" onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
            <button type="button" className="auth-link" onClick={() => setResetSent(false)}>
              Send another link
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <label className="auth-label" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              ref={emailRef}
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={busy}
            />

            {mode !== 'magic' && mode !== 'forgot' && (
              <>
                <label className="auth-label" htmlFor="auth-password">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  className="auth-input"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                  disabled={busy}
                />
              </>
            )}

            {mode === 'signin' && (
              <div className="auth-forgot-row">
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => switchMode('forgot')}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="auth-error" role="alert">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : mode === 'forgot' ? (
                <Mail size={15} />
              ) : (
                <LogIn size={15} />
              )}
              <span>{busy ? 'Working...' : copy.cta}</span>
            </button>
          </form>
        )}

        <div className="auth-switches">
          {mode === 'forgot' ? (
            <>
              <span>{copy.switchLabel}</span>
              <button type="button" className="auth-link" onClick={() => switchMode('signin')}>
                {copy.switchCta}
              </button>
            </>
          ) : mode === 'magic' ? (
            <button type="button" className="auth-link" onClick={() => switchMode('signin')}>
              {copy.switchLabel}
            </button>
          ) : (
            <>
              <span>{copy.switchLabel}</span>
              <button type="button" className="auth-link" onClick={() => switchMode(copy.switchTo as Mode)}>
                {copy.switchCta}
              </button>
              <button type="button" className="auth-link" onClick={() => switchMode('magic')}>
                <Mail size={12} />
                Email me a link
              </button>
            </>
          )}
        </div>

        {mode !== 'forgot' && (
          <div className="auth-guest">
            <div className="auth-guest-rule">
              <span>or</span>
            </div>
            <button type="button" className="auth-guest-btn" onClick={() => { onClose(); onComplete(); }}>
              <UserPlus size={15} />
              <span>Explore as guest</span>
            </button>
            <p className="auth-guest-note">
              Every story is free to read as a guest. An account is only needed to vote and save.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
