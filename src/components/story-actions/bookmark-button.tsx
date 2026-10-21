'use client';

import { useSyncExternalStore, useMemo, useCallback } from 'react';
import { Bookmark } from 'lucide-react';

const BOOKMARKS_KEY = 'signal_bookmarked_stories';

export function getLocalBookmarks(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function saveLocalBookmarks(slugs: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(Array.from(slugs)));
    window.dispatchEvent(new CustomEvent('signal_bookmarks_changed'));
  } catch {
    // Ignore storage quota
  }
}

function subscribe(callback: () => void) {
  window.addEventListener('signal_bookmarks_changed', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('signal_bookmarks_changed', callback);
    window.removeEventListener('storage', callback);
  };
}

function getSnapshot(): string {
  if (typeof window === 'undefined') return '[]';
  try {
    return localStorage.getItem(BOOKMARKS_KEY) || '[]';
  } catch {
    return '[]';
  }
}

function getServerSnapshot(): string {
  return '[]';
}

export function useBookmarks(): [Set<string>, (slug: string) => void] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const bookmarks = useMemo(() => {
    try {
      const arr = JSON.parse(raw);
      return new Set<string>(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const toggleBookmark = useCallback((slug: string) => {
    const current = getLocalBookmarks();
    if (current.has(slug)) {
      current.delete(slug);
    } else {
      current.add(slug);
    }
    saveLocalBookmarks(current);
  }, []);

  return [bookmarks, toggleBookmark];
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
  const [bookmarks, toggleBookmark] = useBookmarks();
  const bookmarked = bookmarks.has(slug);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleBookmark(slug);
    onBookmarkChange?.(slug, !bookmarked);
  };

  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={bookmarked ? 'Remove from saved stories' : 'Save story for later'}
      aria-pressed={bookmarked}
      className={`story-action-btn bookmark-btn ${bookmarked ? 'is-active' : ''} ${className}`}
      title={bookmarked ? 'Saved (click to remove)' : 'Save story for later'}
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

