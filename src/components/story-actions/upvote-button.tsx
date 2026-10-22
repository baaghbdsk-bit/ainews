'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { useAuth, whenAuthSettled } from '@/lib/auth/store';
import { showGuestNotice } from '@/components/auth/guest-notice';
import { getVoteStore, useVoteMirror } from './vote-store';

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
  // The identity the vote is recorded against: the account when signed in.
  const { clientId, status, user } = useAuth();
  const store = useMemo(() => getVoteStore(clientId), [clientId]);
  const localVotes = useVoteMirror(clientId);
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

  const applyLocalVote = useCallback(
    (targetSlug: string, voted: boolean) => {
      const votes = store.read();
      if (voted) votes.add(targetSlug);
      else votes.delete(targetSlug);
      store.write(votes);
    },
    [store],
  );

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
    if (!clientId) return;

    let cancelled = false;

    const load = async () => {
      // Let a sign-in finish moving the guest's votes first, so the reader's
      // own votes are not read as empty.
      await whenAuthSettled();
      if (cancelled) return;

      const res = await fetch(`/api/upvotes?clientId=${encodeURIComponent(clientId)}`);
      if (!res.ok || cancelled) return;
      const payload = await res.json();
      if (cancelled || !payload || typeof payload !== 'object') return;

      const serverCount = payload.counts?.[slug];
      if (typeof serverCount === 'number' && !interactedRef.current) {
        const current = stateRef.current;
        if (current.count !== serverCount) {
          applyVoteState({ voted: current.voted, count: serverCount });
        }
      }

      if (!Array.isArray(payload.userVotes)) return;
      const votes = store.read();
      let changed = false;
      for (const votedSlug of payload.userVotes) {
        if (typeof votedSlug === 'string' && !votes.has(votedSlug)) {
          votes.add(votedSlug);
          changed = true;
        }
      }
      if (changed) store.write(votes);
    };

    load().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [applyVoteState, clientId, parentOwnsVote, slug, store]);

  // A guest can read the count but has no vote of their own to show.
  const voted = user ? (parentOwnsVote ? state.voted : localVotes.has(slug)) : false;

  const handleVote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Voting is an account action. A guest gets a quiet nudge instead of a
    // dialog being forced open over the story.
    if (status !== 'signed-in' || !user) {
      if (status === 'guest') showGuestNotice('Sign in to vote on stories.');
      return;
    }

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
      data-tour-target="vote"
      aria-label={
        user
          ? `${voted ? 'Remove upvote' : 'Upvote'} story (${count} votes)`
          : `Upvote story (${count} votes) - sign in to vote`
      }
      aria-pressed={voted}
      aria-busy={isPending}
      disabled={isPending}
      className={`story-action-btn upvote-btn ${voted ? 'is-active' : ''} ${isPending ? 'is-pending' : ''} ${className}`}
      title={!user ? 'Sign in to vote' : voted ? 'Upvoted (click to undo)' : 'Upvote this story'}
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
