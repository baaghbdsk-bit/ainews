'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getOrCreateClientId } from '@/components/story-actions/client-id';
import { getBookmarkStore } from '@/components/story-actions/bookmark-store';
import { claimGuestVotes } from '@/lib/actions/votes';

export type AuthStatus = 'loading' | 'guest' | 'signed-in';

export interface SignUpResult {
  autoSignedIn: boolean;
  signInError?: string;
}

export interface AuthState {
  user: User | null;
  status: AuthStatus;
  /**
   * The account id when signed in. A guest gets the local browser token,
   * which is now only a storage scope: votes and saves are refused without
   * an account, and the token exists so a legacy guest's data can still be
   * claimed on sign-in.
   */
  clientId: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  sendMagicLink: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Whether the account dialog is open. */
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
}

const GUEST_ID =
  typeof window === 'undefined' ? '' : getOrCreateClientId();

let user: User | null = null;
let ready = false;
let started = false;
let authOpen = false;

const listeners = new Set<() => void>();
let snapshot: AuthState;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthState {
  return snapshot;
}

function openAuth() {
  authOpen = true;
  snapshot = buildSnapshot();
  emit();
}

function closeAuth() {
  authOpen = false;
  snapshot = buildSnapshot();
  emit();
}

function buildSnapshot(): AuthState {
  return {
    user,
    status: !ready ? 'loading' : user ? 'signed-in' : 'guest',
    clientId: user?.id ?? GUEST_ID,
    signIn,
    signUp,
    sendMagicLink,
    resetPassword,
    updatePassword,
    signOut,
    authOpen,
    openAuth,
    closeAuth,
  };
}

snapshot = buildSnapshot();

/**
 * The snapshot used while the server HTML hydrates.
 *
 * It is deliberately frozen at "loading" and an empty client id: the server
 * cannot know the session or the guest token, and the browser's first render
 * has to match the markup that was sent. React swaps in the live snapshot
 * right after hydration.
 */
const SERVER_SNAPSHOT: AuthState = {
  user: null,
  status: 'loading',
  clientId: '',
  signIn,
  signUp,
  sendMagicLink,
  resetPassword,
  updatePassword,
  signOut,
  authOpen: false,
  openAuth,
  closeAuth,
};

function getServerSnapshot(): AuthState {
  return SERVER_SNAPSHOT;
}

/** Where Supabase should send the reader back to after a link. */
function callbackUrl(nextPath?: string): string {
  const next = nextPath ?? `${window.location.pathname}${window.location.search}`;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/**
 * Move a guest's local saves onto the account they just signed in to.
 *
 * The votes move on the server (they are rows already); the saved stories are
 * local only, so this is the one place that has to hand them over. The
 * account's local copy is updated with the same set immediately, so every
 * mounted Save button flips without waiting for a reload. The guest copy is
 * cleared afterwards, or a story removed later would come back on next load.
 */
async function claimGuestBookmarks(userId: string): Promise<void> {
  if (!GUEST_ID || GUEST_ID === userId) return;

  const guestStore = getBookmarkStore(GUEST_ID);
  const guest = guestStore.read();
  if (!guest.size) return;

  const res = await fetch('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slugs: Array.from(guest) }),
  });
  if (!res.ok) return;

  const accountStore = getBookmarkStore(userId);
  accountStore.write(new Set([...accountStore.read(), ...guest]));
  guestStore.write(new Set());
}

async function claimGuest(userId: string) {
  if (!GUEST_ID || GUEST_ID === userId) return;
  try {
    await claimGuestVotes(GUEST_ID);
  } catch {
    // A failed claim must never break the sign-in.
  }
  try {
    await claimGuestBookmarks(userId);
  } catch {
    // Same: keep the reader signed in even if the transfer fails.
  }
}

/**
 * Run the guest transfer once per signed-in account.
 *
 * A link-based sign-in (magic link, email confirmation) establishes its
 * session after the page has loaded, so the only place that sees every kind of
 * sign-in is the auth state listener. The set makes the password path and the
 * listener share one run instead of claiming twice.
 */
let claimedFor: { userId: string; promise: Promise<void> } | null = null;

function ensureGuestClaim(userId: string): Promise<void> {
  if (claimedFor?.userId === userId) return claimedFor.promise;
  const promise = claimGuest(userId);
  claimedFor = { userId, promise };
  return promise;
}

/**
 * Resolves when the guest's votes and saved stories have reached the account.
 *
 * Reads that run on sign-in (the vote counts, for instance) wait for this so
 * they do not snapshot the account before the transfer landed and then show
 * the reader as having voted for nothing.
 */
export function whenAuthSettled(): Promise<void> {
  return claimedFor?.promise ?? Promise.resolve();
}

export async function signIn(email: string, password: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  if (data.user) {
    user = data.user;
    ready = true;
    snapshot = buildSnapshot();
    emit();
    await ensureGuestClaim(data.user.id);
  }
}

export async function signUp(
  email: string,
  password: string,
): Promise<SignUpResult> {
  // The account is created server-side so it can sign in right away instead of
  // waiting on an email. It is recorded as unverified, which the profile shows.
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? 'Could not create the account. Try again.');
  }

  // The account exists from here on. A failed automatic sign-in is a
  // recoverable state, not a failed signup.
  try {
    await signIn(email, password);
    return { autoSignedIn: true };
  } catch (err) {
    return {
      autoSignedIn: false,
      signInError: err instanceof Error ? err.message : 'Automatic sign-in failed.',
    };
  }
}

export async function resetPassword(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl('/auth/reset-password'),
  });
  if (error) {
    if (/rate limit|too many|after \d+ seconds/i.test(error.message)) {
      throw new Error('Too many reset emails. Wait a minute and try again.');
    }
    if (/failed to fetch|network/i.test(error.message)) {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    throw new Error(error.message);
  }
}

export async function updatePassword(password: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/failed to fetch|network/i.test(error.message)) {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    throw new Error(error.message);
  }

  if (data.user) {
    user = data.user;
    ready = true;
    snapshot = buildSnapshot();
    emit();
  }
}

export async function sendMagicLink(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  // A guest token is kept, so the reading experience is unchanged after
  // signing out - the reader is not punished for it.
  user = null;
  ready = true;
  claimedFor = null;
  emit();
}

/**
 * Starts listening for the session. Safe to call more than once.
 *
 * This is a plain store rather than a React context on purpose: the session
 * has to reach components deep in the tree, but the page must not be wrapped
 * in a client component, or the shell is flushed before the page can decide
 * its status and a missing story answers 200 instead of 404.
 */
export function startAuth(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const supabase = createClient();

  supabase.auth.getSession().then(({ data }) => {
    user = data.session?.user ?? null;
    ready = true;
    snapshot = buildSnapshot();
    emit();
    if (data.session?.user) void ensureGuestClaim(data.session.user.id);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    user = session?.user ?? null;
    ready = true;
    snapshot = buildSnapshot();
    emit();
    // Covers the link-based sign-ins that complete after the page loads.
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      void ensureGuestClaim(session.user.id);
    }
  });
}

/** The session state. */
export function useAuth(): AuthState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // The store is built once at module load, so the client id is known before
  // the first render. Nothing to wait for.
  useEffect(() => {
    startAuth();
  }, []);

  return state;
}

/** The account, and the actions a reader can take with it. */
export function useAccount() {
  const { user, status, signIn, signUp, sendMagicLink, resetPassword, updatePassword, signOut } =
    useAuth();
  return useMemo(
    () => ({
      user,
      status,
      signIn,
      signUp,
      sendMagicLink,
      resetPassword,
      updatePassword,
      signOut,
    }),
    [user, status, signIn, signUp, sendMagicLink, resetPassword, updatePassword, signOut],
  );
}
