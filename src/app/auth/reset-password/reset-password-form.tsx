'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  MailCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/store';

export function ResetPasswordForm() {
  const { status, user, updatePassword, resetPassword, openAuth } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== 'signed-in') return;
    const timer = setTimeout(() => passwordRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => router.replace('/'), 1400);
    return () => clearTimeout(timer);
  }, [done, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setResendError(null);
    setResending(true);
    try {
      await resetPassword(email.trim());
      setResent(true);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Could not send the link. Try again.');
    } finally {
      setResending(false);
    }
  };

  const goSignIn = () => {
    router.push('/');
    openAuth();
  };

  return (
    <main className="auth-page">
      <Link href="/" className="auth-page-brand" aria-label="NeuBench home">
        NeuBench<span>.</span>
      </Link>

      <section className="auth-dialog auth-reset-card" aria-labelledby="reset-title">
        {status === 'loading' ? (
          <div className="auth-reset-state" role="status">
            <h1 id="reset-title" className="sr-only">
              Reset password
            </h1>
            <Loader2 size={20} className="animate-spin" />
            <p className="auth-reset-state-text">Checking your reset link…</p>
          </div>
        ) : done ? (
          <div className="auth-reset-state auth-reset-state-success" role="status">
            <span className="auth-reset-icon">
              <CheckCircle2 size={22} />
            </span>
            <h1 id="reset-title" className="auth-title">
              Password updated
            </h1>
            <p className="auth-subtitle">
              You are signed in. Taking you back to the timeline…
            </p>
            <button type="button" className="auth-submit" onClick={() => router.replace('/')}>
              Open the timeline
            </button>
          </div>
        ) : status === 'signed-in' ? (
          <>
            <div className="auth-head">
              <span className="auth-kicker">
                <KeyRound size={12} /> Password reset
              </span>
              <h1 id="reset-title" className="auth-title">
                Choose a new password
              </h1>
              <p className="auth-subtitle">
                {user?.email ? `Updating the password for ${user.email}.` : 'Set a new password for your account.'}
              </p>
            </div>

            <form onSubmit={submit} className="auth-form">
              <label className="auth-label" htmlFor="reset-password">
                New password
              </label>
              <input
                id="reset-password"
                ref={passwordRef}
                type="password"
                className="auth-input"
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                maxLength={72}
                required
                disabled={busy}
              />

              <label className="auth-label" htmlFor="reset-confirm">
                Confirm password
              </label>
              <input
                id="reset-confirm"
                type="password"
                className="auth-input"
                placeholder="Type it again"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                maxLength={72}
                required
                disabled={busy}
              />

              {error && (
                <div className="auth-error" role="alert">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <KeyRound size={15} />
                )}
                <span>{busy ? 'Updating…' : 'Update password'}</span>
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="auth-head">
              <span className="auth-kicker">
                <KeyRound size={12} /> Password reset
              </span>
              <h1 id="reset-title" className="auth-title">
                {resent ? 'Check your inbox' : 'This link is invalid or expired'}
              </h1>
              <p className="auth-subtitle">
                {resent
                  ? 'Check your inbox for the new link. It works once.'
                  : 'Reset links are single-use and expire. Enter your email and we will send a fresh one.'}
              </p>
            </div>

            {resent ? (
              <div className="auth-reset-state">
                <span className="auth-reset-icon">
                  <MailCheck size={20} />
                </span>
                <p className="auth-reset-state-text">
                  If that email has an account, a new link is on its way.
                </p>
                <button type="button" className="auth-submit" onClick={goSignIn}>
                  Back to sign in
                </button>
                <button type="button" className="auth-link" onClick={() => setResent(false)}>
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={resend} className="auth-form">
                <label className="auth-label" htmlFor="reset-email">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={resending}
                />

                {resendError && (
                  <div className="auth-error" role="alert">
                    <AlertCircle size={14} />
                    <span>{resendError}</span>
                  </div>
                )}

                <button type="submit" className="auth-submit" disabled={resending}>
                  {resending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Mail size={15} />
                  )}
                  <span>{resending ? 'Sending…' : 'Send a new link'}</span>
                </button>

                <button type="button" className="auth-link auth-reset-back" onClick={goSignIn}>
                  Back to sign in
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
