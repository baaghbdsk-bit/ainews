'use client';

import {
  getIdentityStore,
  useIdentityMirror,
  type IdentityStore,
} from './identity-store';

export type { IdentityStore };

const BOOKMARKS_BASE = 'signal_bookmarked_stories';

/** The store for an identity's saved stories. */
export function getBookmarkStore(clientId: string): IdentityStore {
  return getIdentityStore(BOOKMARKS_BASE, clientId);
}

/** The identity's saved stories, re-read when the identity changes. */
export function useBookmarkMirror(clientId: string): Set<string> {
  return useIdentityMirror(BOOKMARKS_BASE, clientId);
}

/**
 * One reconciliation per identity per page load.
 *
 * A timeline mounts a Save button per row. Without this guard every one of
 * them would fetch the whole saved list on mount. The promise is kept after it
 * resolves so late mounts reuse the result; a failed run is dropped so the
 * next mount can retry.
 */
const hydrations = new Map<string, Promise<void>>();

/**
 * Reconcile an account's local copy with the server.
 *
 * The server is the source of truth for an account, so a save removed on
 * another device disappears here too. A guest's saves are not lost by that:
 * the sign-in transfer hands them to the account first, and its result is
 * written into this same local copy.
 */
export function hydrateBookmarks(clientId: string): Promise<void> {
  if (!clientId) return Promise.resolve();
  const existing = hydrations.get(clientId);
  if (existing) return existing;

  const store = getBookmarkStore(clientId);
  const run = (async () => {
    const res = await fetch('/api/bookmarks', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return;

    const payload = (await res.json()) as { slugs?: unknown };
    if (!Array.isArray(payload.slugs)) return;
    const server = payload.slugs.filter((s): s is string => typeof s === 'string');
    store.write(new Set(server));
  })();

  hydrations.set(
    clientId,
    run.catch(() => {
      // A failed reconciliation keeps the local copy; let a later mount retry.
      hydrations.delete(clientId);
    }),
  );
  return hydrations.get(clientId) ?? Promise.resolve();
}
