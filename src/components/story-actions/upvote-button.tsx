'use client';

import { useCallback, useMemo } from 'react';
import { ChevronUp } from 'lucide-react';
import { useAuth } from '@/lib/auth/store';
import { getVoteStore, useVoteMirror } from './vote-store';

interface UpvoteButtonProps {
  slug: string;
  initialCount?: number;
  initialVoted?: boolean;
  baseCount?: number;
  onVoteChange?: (slug: string, voted: boolean, newCount: number) => void;
  size?: 'sm' | 'md';
  className?: string;
}

// In-memory debounce queue for background Supabase synchronization:
// storySlug -> { timer, targetVoted }
const dbSyncQueue = new Map<string, { timer: NodeJS.Timeout; targetVoted: boolean }>();

export function UpvoteButton({
  slug,
  initialCount = 0,
  initialVoted,
  baseCount: explicitBaseCount,
  onVoteChange,
  size = 'sm',
  className = '',
}: UpvoteButtonProps) {
  const { clientId, user } = useAuth();
  const store = useMemo(() => getVoteStore(clientId), [clientId]);
  const localVotes = useVoteMirror(clientId);

  // Compute baseline count: votes from all other readers excluding current user
  const effectiveBaseCount = useMemo(() => {
    if (explicitBaseCount !== undefined) return explicitBaseCount;
    return initialVoted ? Math.max(0, initialCount - 1) : initialCount;
  }, [explicitBaseCount, initialCount, initialVoted]);

  // Is this story currently voted by the user?
  const isVoted = initialVoted !== undefined ? initialVoted : localVotes.has(slug);

  // Display count is 100% deterministic: baseline + 1 if voted, else baseline
  const displayCount = effectiveBaseCount + (isVoted ? 1 : 0);

  const applyLocalVote = useCallback(
    (targetSlug: string, voted: boolean) => {
      const votes = store.read();
      if (voted) votes.add(targetSlug);
      else votes.delete(targetSlug);
      store.write(votes);
    },
    [store],
  );

  const handleVote = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const nextVoted = !isVoted;
    const nextCount = effectiveBaseCount + (nextVoted ? 1 : 0);

    // 1. Instant local & session state update (0ms UI latency)
    applyLocalVote(slug, nextVoted);

    // 2. Broadcast event across tabs and parent views (ExploreTabs, Trending list, etc.)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neubench_vote_changed', {
          detail: { slug, voted: nextVoted, count: nextCount },
        })
      );
    }

    onVoteChange?.(slug, nextVoted, nextCount);

    // 3. Debounce server DB sync:
    // Only signed-in users persist to Supabase. Guests keep votes in session/localStorage.
    // While the user clicks rapidly, we reset the timer so only the FINAL state is pushed to DB!
    if (user && user.id) {
      const existing = dbSyncQueue.get(slug);
      if (existing) {
        clearTimeout(existing.timer);
      }

      const timer = setTimeout(async () => {
        dbSyncQueue.delete(slug);
        try {
          await fetch('/api/upvotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storySlug: slug,
              action: nextVoted ? 'up' : 'unvote',
            }),
          });
        } catch (err) {
          console.warn('Debounced upvote push notice:', err);
        }
      }, 1200); // 1.2s after last click

      dbSyncQueue.set(slug, { timer, targetVoted: nextVoted });
    }
  };

  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      onClick={handleVote}
      data-tour-target="vote"
      aria-label={`${isVoted ? 'Remove upvote' : 'Upvote'} story (${displayCount} votes)`}
      aria-pressed={isVoted}
      className={`story-action-btn upvote-btn ${isVoted ? 'is-active' : ''} ${className}`}
      title={isVoted ? 'Upvoted (click to undo)' : 'Upvote this story'}
    >
      <ChevronUp
        size={isSmall ? 15 : 18}
        strokeWidth={isVoted ? 2.8 : 2}
        className={`upvote-icon ${isVoted ? 'translate-y-[-1px]' : ''}`}
      />
      <span className="upvote-count">{displayCount}</span>
    </button>
  );
}
