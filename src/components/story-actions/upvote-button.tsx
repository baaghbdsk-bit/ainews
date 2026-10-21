'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronUp } from 'lucide-react';
import { getOrCreateClientId } from './client-id';

const VOTES_KEY = 'signal_upvoted_stories';
const VOTES_EVENT = 'signal_upvotes_changed';

interface UpvoteButtonProps {
  slug: string;
  initialCount?: number;
  initialVoted?: boolean;
  onVoteChange?: (slug: string, voted: boolean, newCount: number) => void;
  size?: 'sm' | 'md';
  className?: string;
}

interface VoteState {
  voted: boolean;
  count: number;
}

function readLocalVotes(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

function writeLocalVotes(slugs: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOTES_KEY, JSON.stringify(Array.from(slugs)));
    window.dispatchEvent(new CustomEvent(VOTES_EVENT));
  } catch {
    return;
  }
}

function subscribeVotes(callback: () => void) {
  window.addEventListener(VOTES_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(VOTES_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getVotesSnapshot(): string {
  if (typeof window === 'undefined') return '[]';
  try {
    return localStorage.getItem(VOTES_KEY) || '[]';
  } catch {
    return '[]';
  }
}

function getVotesServerSnapshot(): string {
  return '[]';
}

function useLocalVotes(): Set<string> {
  const raw = useSyncExternalStore(subscribeVotes, getVotesSnapshot, getVotesServerSnapshot);
  return useMemo(() => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set<string>();
      return new Set<string>(parsed.filter((value): value is string => typeof value === 'string'));
    } catch {
      return new Set<string>();
    }
  }, [raw]);
}

export function UpvoteButton({
  slug,
  initialCount = 0,
  initialVoted,
  onVoteChange,
  size = 'sm',
  className = '',
}: UpvoteButtonProps) {
  const [state, setState] = useState<VoteState>({
    voted: initialVoted ?? false,
    count: initialCount,
  });
  const [isPending, setIsPending] = useState(false);
  const stateRef = useRef(state);
  const pendingRef = useRef(false);
  const requestIdRef = useRef(0);
  const syncedPropsRef = useRef({ count: initialCount, voted: initialVoted });
  const interactedRef = useRef(false);
  const localVotes = useLocalVotes();
  const parentOwnsVote = initialVoted !== undefined;

  const applyVoteState = useCallback((next: VoteState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const commit = useCallback(
    (next: VoteState) => {
      applyVoteState(next);
      onVoteChange?.(slug, next.voted, next.count);
    },
    [applyVoteState, onVoteChange, slug],
  );

  const applyLocalVote = useCallback((targetSlug: string, voted: boolean) => {
    const votes = readLocalVotes();
    if (voted) votes.add(targetSlug);
    else votes.delete(targetSlug);
    writeLocalVotes(votes);
  }, []);

  useEffect(() => {
    const last = syncedPropsRef.current;
    const countChanged = initialCount !== last.count;
    const votedChanged = parentOwnsVote && initialVoted !== last.voted;
    if (!countChanged && !votedChanged) return;

    syncedPropsRef.current = { count: initialCount, voted: initialVoted };

    const current = stateRef.current;
    applyVoteState({
      voted: votedChanged ? (initialVoted as boolean) : current.voted,
      count: countChanged ? initialCount : current.count,
    });
  }, [applyVoteState, initialCount, initialVoted, parentOwnsVote]);

  useEffect(() => {
    if (parentOwnsVote) return;
    const localVoted = localVotes.has(slug);
    const current = stateRef.current;
    if (current.voted === localVoted) return;
    applyVoteState({ voted: localVoted, count: current.count });
  }, [applyVoteState, localVotes, parentOwnsVote, slug]);

  useEffect(() => {
    if (parentOwnsVote) return;
    const clientId = getOrCreateClientId();
    if (!clientId) return;

    let cancelled = false;
    fetch(`/api/upvotes?clientId=${encodeURIComponent(clientId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload || typeof payload !== 'object') return;

        const serverCount = payload.counts?.[slug];
        if (typeof serverCount === 'number' && !interactedRef.current) {
          const current = stateRef.current;
          if (current.count !== serverCount) {
            applyVoteState({ voted: current.voted, count: serverCount });
          }
        }

        if (!Array.isArray(payload.userVotes)) return;
        const votes = readLocalVotes();
        let changed = false;
        for (const votedSlug of payload.userVotes) {
          if (typeof votedSlug === 'string' && !votes.has(votedSlug)) {
            votes.add(votedSlug);
            changed = true;
          }
        }
        if (changed) writeLocalVotes(votes);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [applyVoteState, parentOwnsVote, slug]);

  const voted = parentOwnsVote ? state.voted : localVotes.has(slug);

  const handleVote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // One request at a time: a double click cannot toggle twice.
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsPending(true);

    const requestId = ++requestIdRef.current;
    const currentVoted = parentOwnsVote ? stateRef.current.voted : localVotes.has(slug);
    interactedRef.current = true;
    const previous: VoteState = {
      voted: currentVoted,
      count: stateRef.current.count,
    };
    const next: VoteState = {
      voted: !currentVoted,
      count: Math.max(0, previous.count + (currentVoted ? -1 : 1)),
    };

    // Optimistic update against the latest state, not a render snapshot.
    commit(next);
    applyLocalVote(slug, next.voted);

    const clientId = getOrCreateClientId();
    if (!clientId) {
      if (requestId === requestIdRef.current) {
        pendingRef.current = false;
        setIsPending(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/upvotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storySlug: slug, clientId }),
      });

      // A newer request supersedes this one; its response is stale.
      if (requestId !== requestIdRef.current) return;

      if (!res.ok) throw new Error(`Upvote failed with ${res.status}`);

      const data = await res.json();
      if (requestId !== requestIdRef.current) return;
      if (typeof data.hasVoted === 'boolean' && typeof data.totalVotes === 'number') {
        commit({ voted: data.hasVoted, count: data.totalVotes });
        applyLocalVote(slug, data.hasVoted);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to sync vote:', err);
      // Roll back only this, the latest, request.
      commit(previous);
      applyLocalVote(slug, previous.voted);
    } finally {
      if (requestId === requestIdRef.current) {
        pendingRef.current = false;
        setIsPending(false);
      }
    }
  };

  const isSmall = size === 'sm';
  const { count } = state;

  return (
    <button
      type="button"
      onClick={handleVote}
      aria-label={`${voted ? 'Remove upvote' : 'Upvote'} story (${count} votes)`}
      aria-pressed={voted}
      aria-busy={isPending}
      disabled={isPending}
      className={`story-action-btn upvote-btn ${voted ? 'is-active' : ''} ${isPending ? 'is-pending' : ''} ${className}`}
      title={voted ? 'Upvoted (click to undo)' : 'Upvote this story'}
    >
      <ChevronUp
        size={isSmall ? 15 : 18}
        strokeWidth={voted ? 2.8 : 2}
        className={`upvote-icon ${voted ? 'translate-y-[-1px]' : ''}`}
      />
      <span className="upvote-count">{count}</span>
    </button>
  );
}
