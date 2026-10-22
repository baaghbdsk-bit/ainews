'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { LogIn, Sparkles, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth/store';

const SEEN_KEY = 'neubench_welcome_seen';

const listeners = new Set<() => void>();

function readSeen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // If storage is blocked, do not nag on every render.
    return true;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SEEN_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // See readSeen: a blocked store must not break the page.
  }
  for (const listener of listeners) listener();
}

/** The server cannot read sessionStorage, so it always renders the gate hidden. */
function getServerSeen() {
  return true;
}

/**
 * The first-visit choice: an account, or the timeline as a guest.
 *
 * It is deliberately not a wall. "Explore as guest" is one click, the gate is
 * remembered for the rest of the tab's session, and a signed-in reader never
 * sees it.
 */
export function WelcomeGate() {
  const { status, authOpen, openAuth } = useAuth();
  const seen = useSyncExternalStore(subscribe, readSeen, getServerSeen);
  const pathname = usePathname();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isAuthRoute = pathname?.startsWith('/auth') ?? false;
  const visible = !seen && status === 'guest' && !authOpen && !isAuthRoute;

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => primaryRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        markSeen();
        return;
      }
      if (e.key !== 'Tab' || !cardRef.current) return;

      const focusables = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled'));
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
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [visible]);

  // Browsers do not expose a "hard reload" event. The shortcuts are the one
  // reliable signal, so treat them as a request to see the gate again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const hardReload =
        (e.key === 'F5' && (e.ctrlKey || e.shiftKey)) ||
        (e.key.toLowerCase() === 'r' && e.shiftKey && (e.ctrlKey || e.metaKey));
      if (!hardReload) return;

      try {
        sessionStorage.removeItem(SEEN_KEY);
      } catch {
        // A blocked store still leaves the in-memory listeners to update.
      }
      for (const listener of listeners) listener();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const chooseAccount = useCallback(() => {
    markSeen();
    openAuth();
  }, [openAuth]);

  if (!visible) return null;

  return (
    <div
      className="auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="auth-dialog welcome-dialog" ref={cardRef}>
        <div className="auth-head">
          <span className="auth-kicker">
            <Sparkles size={12} />
            NeuBench
          </span>
          <h2 id="welcome-title" className="auth-title">
            Read the AI timeline
          </h2>
          <p className="auth-subtitle">
            Sign in to vote and save stories, or explore the timeline as a guest.
          </p>
        </div>

        <div className="welcome-actions">
          <button ref={primaryRef} type="button" className="auth-submit" onClick={chooseAccount}>
            <LogIn size={15} />
            <span>Sign in or create an account</span>
          </button>
          <button type="button" className="auth-guest-btn" onClick={markSeen}>
            <UserPlus size={15} />
            <span>Explore as guest</span>
          </button>
        </div>

        <p className="auth-guest-note">
          Guests can read every story. Voting and saving need an account.
        </p>
      </div>
    </div>
  );
}
