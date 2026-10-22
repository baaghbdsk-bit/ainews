'use client';

import {
  getIdentityStore,
  useIdentityMirror,
  type IdentityStore,
} from './identity-store';

export type { IdentityStore };

const VOTES_BASE = 'signal_upvoted_stories';

/** The store for an identity's vote mirror. */
export function getVoteStore(clientId: string): IdentityStore {
  return getIdentityStore(VOTES_BASE, clientId);
}

/** The identity's vote mirror, re-read when the identity changes. */
export function useVoteMirror(clientId: string): Set<string> {
  return useIdentityMirror(VOTES_BASE, clientId);
}
