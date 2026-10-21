import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/env';
import {
  clientIp,
  isMissingFunctionError,
  isMissingSchemaError,
  isStoryMissingError,
  isUniqueViolation,
  jsonNoStore,
  rateLimit,
  readJsonBody,
  tooManyRequests,
  zodDetails,
} from '@/lib/supabase/api-guard';

const POST_LIMIT = 30;
const POST_WINDOW_MS = 60_000;
const GET_LIMIT = 120;

const ActionSchema = z.enum(['up', 'unvote', 'toggle']);
const TrimmedString = (min: number, max: number) =>
  z.string().transform((value) => value.trim()).pipe(z.string().min(min).max(max));

const UpvoteSchema = z.object({
  storySlug: TrimmedString(1, 200),
  clientId: TrimmedString(1, 128),
  action: ActionSchema.optional(),
});

const UpvoteQuerySchema = z.object({
  clientId: TrimmedString(1, 128).optional(),
});

type VoteAction = z.infer<typeof ActionSchema>;
type VoteState = { hasVoted: boolean; totalVotes: number };

function getAdminClient(): SupabaseClient | null {
  try {
    const url = supabaseUrl();
    const serviceKey = supabaseServiceRoleKey();
    if (!url || !serviceKey) return null;
    return createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  } catch {
    return null;
  }
}

/** Development fallback only: used when the tables/functions are not migrated. */
const memoryVotes = new Map<string, Set<string>>();

function applyMemoryVote(storySlug: string, clientId: string, action: VoteAction): VoteState {
  let voters = memoryVotes.get(storySlug);
  if (!voters) {
    voters = new Set();
    memoryVotes.set(storySlug, voters);
  }

  if (action === 'up') voters.add(clientId);
  else if (action === 'unvote') voters.delete(clientId);
  else if (voters.has(clientId)) voters.delete(clientId);
  else voters.add(clientId);

  return { hasVoted: voters.has(clientId), totalVotes: voters.size };
}

function memorySnapshot(clientId: string) {
  const counts: Record<string, number> = {};
  const userVotes: string[] = [];
  for (const [slug, voters] of memoryVotes.entries()) {
    counts[slug] = voters.size;
    if (clientId && voters.has(clientId)) userVotes.push(slug);
  }
  return { counts, userVotes };
}

class StoryNotFoundError extends Error {}
class MissingVoteSchemaError extends Error {}

interface RpcRow {
  has_voted?: unknown;
  total_votes?: unknown;
}

function rpcState(data: unknown): VoteState | null {
  if (!Array.isArray(data) || !data[0]) return null;
  const row = data[0] as RpcRow;
  return {
    hasVoted: Boolean(row.has_voted),
    totalVotes: Number(row.total_votes ?? 0),
  };
}

async function recountVotes(
  supabase: SupabaseClient,
  storySlug: string,
  hasVoted: boolean,
): Promise<VoteState> {
  const { count, error: countErr } = await supabase
    .from('story_upvotes')
    .select('id', { count: 'exact', head: true })
    .eq('story_slug', storySlug);
  if (countErr) {
    if (isMissingSchemaError(countErr)) throw new MissingVoteSchemaError();
    throw countErr;
  }

  const totalVotes = count ?? 0;
  const { error: upsertErr } = await supabase.from('story_vote_counts').upsert({
    story_slug: storySlug,
    upvote_count: totalVotes,
    updated_at: new Date().toISOString(),
  });
  if (upsertErr) {
    if (isMissingSchemaError(upsertErr)) throw new MissingVoteSchemaError();
    throw upsertErr;
  }

  return { hasVoted, totalVotes };
}

async function applyTableVote(
  supabase: SupabaseClient,
  storySlug: string,
  clientId: string,
  action: VoteAction,
): Promise<VoteState> {
  // Feed stories are not always published rows, so a vote is keyed by slug
  // alone: the vote table carries no foreign key to `stories`.
  let hasVoted: boolean;

  if (action === 'up') {
    const { error } = await supabase
      .from('story_upvotes')
      .insert({ story_slug: storySlug, client_id: clientId });
    if (error) {
      if (isUniqueViolation(error)) {
        // Already upvoted: this is the idempotent success path.
      } else if (isStoryMissingError(error)) {
        throw new StoryNotFoundError();
      } else if (isMissingSchemaError(error)) {
        throw new MissingVoteSchemaError();
      } else {
        throw error;
      }
    }
    hasVoted = true;
  } else if (action === 'unvote') {
    const { error } = await supabase
      .from('story_upvotes')
      .delete()
      .eq('story_slug', storySlug)
      .eq('client_id', clientId);
    if (error) {
      if (isMissingSchemaError(error)) throw new MissingVoteSchemaError();
      throw error;
    }
    hasVoted = false;
  } else {
    const { data: existing, error: selectErr } = await supabase
      .from('story_upvotes')
      .select('id')
      .eq('story_slug', storySlug)
      .eq('client_id', clientId)
      .maybeSingle();
    if (selectErr) {
      if (isMissingSchemaError(selectErr)) throw new MissingVoteSchemaError();
      throw selectErr;
    }

    if (existing) {
      const { error } = await supabase
        .from('story_upvotes')
        .delete()
        .eq('story_slug', storySlug)
        .eq('client_id', clientId);
      if (error) {
        if (isMissingSchemaError(error)) throw new MissingVoteSchemaError();
        throw error;
      }
      hasVoted = false;
    } else {
      const { error } = await supabase
        .from('story_upvotes')
        .insert({ story_slug: storySlug, client_id: clientId });
      if (error && !isUniqueViolation(error)) {
        if (isMissingSchemaError(error)) throw new MissingVoteSchemaError();
        if (isStoryMissingError(error)) throw new StoryNotFoundError();
        throw error;
      }
      hasVoted = true;
    }
  }

  return recountVotes(supabase, storySlug, hasVoted);
}

async function applySupabaseVote(
  supabase: SupabaseClient,
  storySlug: string,
  clientId: string,
  action: VoteAction,
): Promise<VoteState> {
  if (action === 'up' || action === 'unvote') {
    // set_story_upvote is idempotent: retries and double-clicks cannot undo.
    const { data, error } = await supabase.rpc('set_story_upvote', {
      p_story_slug: storySlug,
      p_client_id: clientId,
      p_voted: action === 'up',
    });
    const state = rpcState(data);
    if (!error && state) return state;
    if (error) {
      if (isStoryMissingError(error)) throw new StoryNotFoundError();
      if (isMissingSchemaError(error) && !isMissingFunctionError(error)) {
        throw new MissingVoteSchemaError();
      }
      if (!isMissingFunctionError(error)) throw error;
    }
    return applyTableVote(supabase, storySlug, clientId, action);
  }

  // Legacy shape: the current UI sends no action and expects a toggle.
  const { data, error } = await supabase.rpc('toggle_story_upvote', {
    p_story_slug: storySlug,
    p_client_id: clientId,
  });
  const state = rpcState(data);
  if (!error && state) return state;
  if (error) {
    if (isStoryMissingError(error)) throw new StoryNotFoundError();
    if (isMissingSchemaError(error) && !isMissingFunctionError(error)) {
      throw new MissingVoteSchemaError();
    }
    if (!isMissingFunctionError(error)) throw error;
  }
  return applyTableVote(supabase, storySlug, clientId, action);
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(`upvotes:get:${clientIp(request)}`, GET_LIMIT, POST_WINDOW_MS);
  if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);

  const parsed = UpvoteQuerySchema.safeParse({
    clientId: request.nextUrl.searchParams.get('clientId') ?? undefined,
  });
  if (!parsed.success) {
    return jsonNoStore(
      { error: 'Invalid query parameters', details: zodDetails(parsed.error) },
      { status: 400 },
    );
  }

  const clientId = parsed.data.clientId ?? '';
  const supabase = getAdminClient();
  if (!supabase) return jsonNoStore(memorySnapshot(clientId));

  try {
    const { data: countRows, error: countErr } = await supabase
      .from('story_vote_counts')
      .select('story_slug, upvote_count');

    if (countErr) {
      if (isMissingSchemaError(countErr)) return jsonNoStore(memorySnapshot(clientId));
      console.error('Failed to read vote counts:', countErr);
      return jsonNoStore({ error: 'Failed to load votes' }, { status: 500 });
    }

    const counts: Record<string, number> = {};
    for (const row of (countRows ?? []) as Array<{ story_slug: string; upvote_count: number }>) {
      counts[row.story_slug] = row.upvote_count;
    }

    const userVotes: string[] = [];
    if (clientId) {
      const { data: voteRows, error: voteErr } = await supabase
        .from('story_upvotes')
        .select('story_slug')
        .eq('client_id', clientId);

      if (voteErr) {
        if (isMissingSchemaError(voteErr)) return jsonNoStore(memorySnapshot(clientId));
        console.error('Failed to read user votes:', voteErr);
        return jsonNoStore({ error: 'Failed to load votes' }, { status: 500 });
      }

      for (const row of (voteRows ?? []) as Array<{ story_slug: string }>) {
        userVotes.push(row.story_slug);
      }
    }

    return jsonNoStore({ counts, userVotes });
  } catch (err) {
    console.error('Upvote GET error:', err);
    return jsonNoStore({ error: 'Failed to load votes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = UpvoteSchema.safeParse(body.body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: 'Invalid request body', details: zodDetails(parsed.error) },
      { status: 400 },
    );
  }

  const { storySlug, clientId, action = 'toggle' } = parsed.data;

  const ipLimit = rateLimit(`upvotes:post:ip:${clientIp(request)}`, POST_LIMIT * 2, POST_WINDOW_MS);
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);

  const clientLimit = rateLimit(`upvotes:post:client:${clientId}`, POST_LIMIT, POST_WINDOW_MS);
  if (!clientLimit.allowed) return tooManyRequests(clientLimit.retryAfterSeconds);

  const supabase = getAdminClient();
  if (!supabase) return jsonNoStore(applyMemoryVote(storySlug, clientId, action));

  try {
    return jsonNoStore(await applySupabaseVote(supabase, storySlug, clientId, action));
  } catch (err) {
    if (err instanceof StoryNotFoundError) {
      return jsonNoStore({ error: 'Story not found' }, { status: 404 });
    }
    if (err instanceof MissingVoteSchemaError) {
      return jsonNoStore(applyMemoryVote(storySlug, clientId, action));
    }
    console.error('Upvote POST error:', err);
    return jsonNoStore({ error: 'Failed to record vote' }, { status: 500 });
  }
}
