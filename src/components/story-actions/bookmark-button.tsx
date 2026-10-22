'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { Bookmark } from 'lucide-react';
import { useAuth } from '@/lib/auth/store';
import { showGuestNotice } from '@/components/auth/guest-notice';
import { getBookmarkStore, hydrateBookmarks, useBookmarkMirror } from './bookmark-store';

/** A guest has no saved stories: saving is an account action. */
const NO_BOOKMARKS = new Set<string>();

/**
 * The account's saved stories, a way to add or remove one, and a way to
 * replace the whole set.
 *
 * Saving needs an account, so a guest reads as an empty set and is offered
 * the sign-in choice instead of a silent no-op.
 */
export function useBookmarks(): [Set<string>, (slug: string) => void, (slugs: Set<string>) => void] {
  const { clientId, user, status } = useAuth();
  const store = useMemo(() => getBookmarkStore(clientId), [clientId]);
  const bookmarks = useBookmarkMirror(clientId);

  useEffect(() => {
    if (!user || status !== 'signed-in') return;
    void hydrateBookmarks(clientId);
  }, [clientId, status, user]);

  const toggleBookmark = useCallback(
    (slug: string) => {
      if (status !== 'signed-in' || !user) {
        if (status === 'guest') showGuestNotice('Sign in to save stories.');
        return;
      }
      const current = store.read();
      if (current.has(slug)) current.delete(slug);
      else current.add(slug);
      store.write(current);
    },
    [status, store, user],
  );

  const replaceBookmarks = useCallback(
    (slugs: Set<string>) => {
      store.write(slugs);
    },
    [store],
  );

  return [user ? bookmarks : NO_BOOKMARKS, toggleBookmark, replaceBookmarks];
}

interface BookmarkButtonProps {
  slug: string;
  onBookmarkChange?: (slug: string, isBookmarked: boolean) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function BookmarkButton({
  slug,
  onBookmarkChange,
  size = 'sm',
  className = '',
}: BookmarkButtonProps) {
  const { user, clientId, status } = useAuth();
  const store = useMemo(() => getBookmarkStore(clientId), [clientId]);
  const bookmarks = useBookmarkMirror(clientId);
  const bookmarked = user ? bookmarks.has(slug) : false;

  // A signed-in reader's saved stories live on the account, so the local copy
  // is reconciled when the identity changes. The reconciliation is shared by
  // every Save button on the page.
  useEffect(() => {
    if (!user || status !== 'signed-in') return;
    void hydrateBookmarks(clientId);
  }, [clientId, status, user]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Saving is an account action. A guest gets a quiet nudge instead of a
    // dialog being forced open over the story.
    if (status !== 'signed-in' || !user) {
      if (status === 'guest') showGuestNotice('Sign in to save stories.');
      return;
    }

    const current = store.read();
    const wasBookmarked = current.has(slug);
    if (wasBookmarked) current.delete(slug);
    else current.add(slug);
    store.write(current);
    onBookmarkChange?.(slug, !wasBookmarked);

    if (!user) return;

    // Keep the account in step, but never block the local change on it.
    try {
      const res = await fetch('/api/bookmarks', {
        method: wasBookmarked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) throw new Error(`Bookmark request failed with ${res.status}`);
    } catch (err) {
      console.error('Failed to sync saved story:', err);
      // Put the button back, so it never claims a save the account does not
      // have.
      const reverted = store.read();
      if (wasBookmarked) reverted.add(slug);
      else reverted.delete(slug);
      store.write(reverted);
      onBookmarkChange?.(slug, wasBookmarked);
    }
  };

  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      onClick={handleToggle}
      data-tour-target="bookmark"
      aria-label={
        !user
          ? 'Save story for later - sign in to save'
          : bookmarked
            ? 'Remove from saved stories'
            : 'Save story for later'
      }
      aria-pressed={bookmarked}
      className={`story-action-btn bookmark-btn ${bookmarked ? 'is-active' : ''} ${className}`}
      title={!user ? 'Sign in to save stories' : bookmarked ? 'Saved (click to remove)' : 'Save story for later'}
    >
      <Bookmark
        size={isSmall ? 14 : 16}
        strokeWidth={bookmarked ? 2.5 : 1.8}
        className={`bookmark-icon ${bookmarked ? 'fill-current' : ''}`}
      />
      <span className="action-btn-label">{bookmarked ? 'Saved' : 'Save'}</span>
    </button>
  );
}
