'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * A set of slugs kept in localStorage, scoped to one identity.
 *
 * A reader can be a guest on one device and signed in on another, and the two
 * sets of votes and saved stories are different. Scoping the storage to the
 * identity keeps them apart, so a sign-in does not make the button show the
 * wrong state.
 */
export interface IdentityStore {
  /** The localStorage key this identity's set lives under. */
  key: string;
  /** Read the current set. */
  read: () => Set<string>;
  /** Replace the set. */
  write: (values: Set<string>) => void;
  /** Subscribe to changes from this tab and from other tabs. */
  subscribe: (onChange: () => void) => () => void;
  /** The set as a stable string, for useSyncExternalStore. */
  snapshot: () => string;
}

const stores = new Map<string, IdentityStore>();

/** The localStorage key for an identity's set. */
export function identityStoreKey(base: string, clientId: string): string {
  if (!clientId) return base;
  return `${base}:${clientId}`;
}

/** The store for an identity, created once and shared by every consumer. */
export function getIdentityStore(base: string, clientId: string): IdentityStore {
  const key = identityStoreKey(base, clientId);
  let store = stores.get(key);
  if (!store) {
    store = buildStore(key);
    stores.set(key, store);
  }
  return store;
}

function buildStore(key: string): IdentityStore {
  const eventName = `${key}-changed`;

  const read = () => {
    if (typeof window === 'undefined') return new Set<string>();
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return new Set<string>();
      return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    } catch {
      return new Set<string>();
    }
  };

  const write = (values: Set<string>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(values)));
      window.dispatchEvent(new CustomEvent(eventName));
    } catch {
      // Ignore private browsing quota issues.
    }
  };

  const subscribe = (onChange: () => void) => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) onChange();
    };
    window.addEventListener(eventName, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(eventName, onChange);
      window.removeEventListener('storage', onStorage);
    };
  };

  const snapshot = () => {
    if (typeof window === 'undefined') return '[]';
    try {
      return localStorage.getItem(key) || '[]';
    } catch {
      return '[]';
    }
  };

  return { key, read, write, subscribe, snapshot };
}

/**
 * Reads the set for an identity and re-reads it when the identity changes.
 *
 * A sign-in swaps the identity, so the set the page is showing has to change
 * with it.
 */
export function useIdentityMirror(base: string, clientId: string): Set<string> {
  const store = useMemo(() => getIdentityStore(base, clientId), [base, clientId]);
  const [values, setValues] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      setValues(store.read());
    };
    refresh();
    const unsubscribe = store.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [store]);

  return values;
}
