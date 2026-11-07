'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Mail,
  MailCheck,
  Sparkles,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth, startAuth } from '@/lib/auth/store';
import { NeubenchLogo } from '@/components/neubench-logo';
import { NeubenchSpinner } from '@/components/loading';

export type AuthMode = 'signin' | 'signup' | 'magic' | 'forgot';

const COPY: Record<AuthMode, {
  title: string;
  subtitle: string;
  cta: string;
  switchTo: AuthMode;
  switchLabel: string;
  switchCta: string;
}> = {
  signin: {
    title: 'Welcome back',
    subtitle: 'Sign in to access your saved stories and synced community votes.',
    cta: 'Sign In',
    switchTo: 'signup',
    switchLabel: "Don't have an account?",
    switchCta: 'Create account',
  },
  signup: {
    title: 'Create an account',
    subtitle: 'Sync your reading list, vote on top AI breakthroughs, and track models.',
    cta: 'Create Account',
    switchTo: 'signin',
    switchLabel: 'Already have an account?',
    switchCta: 'Sign in',
  },
  magic: {
    title: 'Email me a link',
    subtitle: 'No password needed. We will send a secure one-click sign-in link.',
    cta: 'Send Sign-in Link',
    switchTo: 'signin',
    switchLabel: 'Prefer using a password?',
    switchCta: 'Sign in with password',
  },
  forgot: {
    title: 'Reset password',
    subtitle: 'Enter your email address and we will send you a password reset link.',
    cta: 'Send Reset Link',
    switchTo: 'signin',
    switchLabel: 'Remembered your password?',
    switchCta: 'Back to sign in',
  },
};

/**
 * The modal auth dialog.
 */
export function AuthDialog() {
  const { authOpen, closeAuth } = useAuth();

  useEffect(() => {
    startAuth();
  }, []);

  if (!authOpen) return null;

  return (
    <div
      className="auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeAuth();
      }}
    >
      <div className="auth-dialog">
        <button
          type="button"
          className="auth-close"
          onClick={closeAuth}
          aria-label="Close authentication dialog"
        >
          <X size={16} />
        </button>
        <AuthCard initialMode="signin" onClose={closeAuth} isModal />
      </div>
    </div>
  );
}

/**
 * Reusable Auth Card component used both in AuthDialog and standalone pages (/login, /signup).
 */
export function AuthCard({
  initialMode = 'signin',
  onClose,
  onSuccess,
  isModal = false,
}: {
  initialMode?: AuthMode;
  onClose?: () => void;
  onSuccess?: () => void;
  isModal?: boolean;
}) {
  const router = useRouter();
  const { signIn, signInWithGoogle, signUp, sendMagicLink, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [mode]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setResetSent(false);
    setPassword('');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in could not be started.');
      setBusy(false);
    }
  };

  const handleFinish = () => {
    if (onClose) onClose();
    if (onSuccess) onSuccess();
    else if (!isModal) {
      router.push('/explore?view=latest');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'signup' || mode === 'signin') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(trimmedEmail, password);
        handleFinish();
      } else if (mode === 'signup') {
        const result = await signUp(trimmedEmail, password, fullName.trim());
        if (result.autoSignedIn) {
          handleFinish();
        } else {
          setMode('signin');
          setPassword('');
          setNotice('Account created successfully! Please sign in with your credentials.');
        }
      } else if (mode === 'forgot') {
        await resetPassword(trimmedEmail);
        setResetSent(true);
      } else {
        await sendMagicLink(trimmedEmail);
        setNotice('Sign-in link sent! Please check your email inbox.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = COPY[mode];

  return (
    <div className={`auth-card-body ${isModal ? 'is-modal' : 'is-standalone'}`}>
      {/* Brand Header */}
      {!isModal ? (
        <div className="auth-brand-badge">
          <Link href="/home" className="auth-brand-logo-link" title="NeuBench Home">
            <NeubenchLogo variant="icon" size={24} />
          </Link>
          <span className="auth-brand-kicker">
            <Sparkles size={12} className="auth-sparkle-icon" />
            NeuBench AI Account
          </span>
        </div>
      ) : (
        <div className="auth-brand-badge auth-brand-badge-modal">
          <NeubenchLogo variant="icon" size={20} />
          <span className="auth-brand-kicker">NeuBench AI Account</span>
        </div>
      )}

      {/* Segmented Mode Selector for signin & signup */}
      {(mode === 'signin' || mode === 'signup') && (
        <div className="auth-mode-segmented-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`auth-segment-tab ${mode === 'signin' ? 'is-active' : ''}`}
            onClick={() => switchMode('signin')}
            disabled={busy}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-segment-tab ${mode === 'signup' ? 'is-active' : ''}`}
            onClick={() => switchMode('signup')}
            disabled={busy}
          >
            Create Account
          </button>
        </div>
      )}

      <div className="auth-head">
        <h2 id="auth-dialog-title" className="auth-title">
          {copy.title}
        </h2>
        <p className="auth-subtitle">{copy.subtitle}</p>
      </div>

      {notice && (
        <div className="auth-notice" role="status">
          <CheckCircle2 size={15} />
          <span>{notice}</span>
        </div>
      )}

      {mode === 'forgot' && resetSent ? (
        <div className="auth-sent" role="status">
          <span className="auth-sent-icon">
            <MailCheck size={22} />
          </span>
          <h3 className="auth-sent-title">Check your inbox</h3>
          <p className="auth-sent-text">
            If an account exists for <strong>{email}</strong>, a password reset link is on its
            way. The link works once and expires shortly.
          </p>
          <button type="button" className="auth-submit" onClick={() => switchMode('signin')}>
            Back to sign in
          </button>
          <button type="button" className="auth-link" onClick={() => setResetSent(false)}>
            Send another link
          </button>
        </div>
      ) : (
        <>
          {(mode === 'signin' || mode === 'signup') && (
            <div className="auth-oauth-group">
              <button
                type="button"
                className="auth-google-btn"
                onClick={handleGoogleSignIn}
                disabled={busy}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
              <div className="auth-divider">
                <span>or continue with email</span>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="auth-form" noValidate>
            {mode === 'signup' && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-fullname">
                  Full Name <span className="auth-label-opt">(optional)</span>
                </label>
                <div className="auth-input-wrap">
                  <User size={14} className="auth-input-icon" />
                  <input
                    id="auth-fullname"
                    type="text"
                    className="auth-input with-icon"
                    placeholder="e.g. Alex Rivera"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    disabled={busy}
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-email">
                Email Address
              </label>
              <div className="auth-input-wrap">
                <Mail size={14} className="auth-input-icon" />
                <input
                  id="auth-email"
                  ref={emailRef}
                  type="email"
                  className="auth-input with-icon"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={busy}
                />
              </div>
            </div>

            {mode !== 'magic' && mode !== 'forgot' && (
              <div className="auth-field">
                <div className="auth-field-header">
                  <label className="auth-label" htmlFor="auth-password">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      className="auth-link auth-forgot-link"
                      onClick={() => switchMode('forgot')}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="auth-input-wrap auth-password-wrap">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input auth-password-input"
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    minLength={6}
                    required
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="auth-error" role="alert">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? (
                <>
                  <NeubenchSpinner size={15} strokeWidth={5} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {mode === 'forgot' ? (
                    <Mail size={15} />
                  ) : mode === 'signup' ? (
                    <UserPlus size={15} />
                  ) : (
                    <LogIn size={15} />
                  )}
                  <span>{copy.cta}</span>
                </>
              )}
            </button>
          </form>
        </>
      )}

      {/* Switch helpers & Magic link */}
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
          <div className="auth-secondary-actions">
            <button
              type="button"
              className="auth-link auth-magic-link"
              onClick={() => switchMode('magic')}
            >
              <Mail size={12} />
              <span>Email me a sign-in link</span>
            </button>
          </div>
        )}
      </div>

      {mode !== 'forgot' && isModal && (
        <div className="auth-guest-compact">
          <button
            type="button"
            className="auth-guest-link"
            onClick={() => {
              if (onClose) onClose();
            }}
          >
            Continue reading as guest
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="auth-google-icon">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
      />
    </svg>
  );
}
