'use client';

import { useSyncExternalStore } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth/store';

interface GuestNoticeState {
  id: number;
  text: string;
}

let current: GuestNoticeState | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

function getServerSnapshot() {
  return null;
}

function hide() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!current) return;
  current = null;
  emit();
}

/**
 * A quiet, dismissible nudge for an action a guest cannot take.
 *
 * It replaces forcing the sign-in dialog open: the reader sees what happened
 * at the bottom of the screen and can choose to sign in from there.
 */
export function showGuestNotice(text: string) {
  if (timer) clearTimeout(timer);
  current = { id: nextId++, text };
  emit();
  timer = setTimeout(() => {
    current = null;
    timer = null;
    emit();
  }, 4200);
}

export function GuestNotice() {
  const notice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { openAuth } = useAuth();

  if (!notice) return null;

  return (
    <div className="guest-notice" role="status" aria-live="polite">
      <Lock size={14} className="guest-notice-icon" />
      <span className="guest-notice-text">{notice.text}</span>
      <button
        type="button"
        className="guest-notice-action"
        onClick={() => {
          hide();
          openAuth();
        }}
      >
        <LogIn size={13} />
        <span>Sign in</span>
      </button>
    </div>
  );
}
