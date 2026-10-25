import { createClient } from '@supabase/supabase-js';
import { hasSupabaseServiceRole, supabaseServiceRoleKey, supabaseUrl } from '@/lib/env';
import { isMissingSchemaError } from '@/lib/supabase/api-guard';
import type { Database } from '@/lib/supabase/types';

type Client = ReturnType<typeof createClient<Database>>;

export type NewsReviewStatus = 'pending' | 'approved' | 'rejected' | 'deferred' | 'duplicate';
export type NewsValidationStatus = 'validated' | 'held' | 'failed' | 'unknown';

export type NewsReviewCandidate = Database['public']['Tables']['news_review_candidates']['Row'];

export interface NewsReviewFeed {
  candidates: NewsReviewCandidate[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<NewsReviewStatus | 'all', number>;
  generatedAt: string;
  warning: string | null;
}

export interface NewsReviewActionInput {
  id: string;
  action: 'approve' | 'reject' | 'defer' | 'duplicate';
  reason?: string | null;
  duplicateOf?: string | null;
  reviewerId?: string | null;
  reviewerEmail?: string | null;
}

function getClient(): Client | null {
  if (!hasSupabaseServiceRole()) return null;
  try {
    return createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}

const STATUSES: NewsReviewStatus[] = ['pending', 'approved', 'rejected', 'deferred', 'duplicate'];

export async function getNewsReviewFeed(options: {
  status?: NewsReviewStatus | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<NewsReviewFeed> {
  const generatedAt = new Date().toISOString();
  const status = options.status ?? 'all';
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  const search = (options.search ?? '').trim();

  const counts: Record<NewsReviewStatus | 'all', number> = {
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    deferred: 0,
    duplicate: 0,
  };

  const client = getClient();
  if (!client) {
    return {
      candidates: [],
      total: 0,
      page,
      pageSize,
      counts,
      generatedAt,
      warning:
        'SUPABASE_SERVICE_ROLE_KEY is not configured. News review records cannot be read.',
    };
  }

  try {
    // Counts by status (bounded, head-only).
    const countResults = await Promise.all([
      client.from('news_review_candidates').select('id', { count: 'exact', head: true }),
      ...STATUSES.map((item) =>
        client
          .from('news_review_candidates')
          .select('id', { count: 'exact', head: true })
          .eq('review_status', item),
      ),
    ]);
    counts.all = countResults[0].count ?? 0;
    STATUSES.forEach((item, index) => {
      counts[item] = countResults[index + 1].count ?? 0;
    });

    let query = client
      .from('news_review_candidates')
      .select('*', { count: 'exact' })
      .order('discovered_at', { ascending: false })
      .order('id', { ascending: false });

    if (status !== 'all') {
      query = query.eq('review_status', status);
    }

    const safeSearch = search.replace(/[,%]/g, ' ').slice(0, 120);
    if (safeSearch) {
      query = query.or(`headline.ilike.%${safeSearch}%,publisher.ilike.%${safeSearch}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) {
      if (isMissingSchemaError(error)) {
        return {
          candidates: [],
          total: 0,
          page,
          pageSize,
          counts,
          generatedAt,
          warning: 'The news_review_candidates table does not exist yet. Apply migration 018.',
        };
      }
      console.error('Failed to read news review queue:', error);
      return {
        candidates: [],
        total: 0,
        page,
        pageSize,
        counts,
        generatedAt,
        warning: 'The news review queue could not be read. Check the server logs for the PostgREST error.',
      };
    }

    return {
      candidates: (data ?? []) as NewsReviewCandidate[],
      total: count ?? 0,
      page,
      pageSize,
      counts,
      generatedAt,
      warning: null,
    };
  } catch (err) {
    console.error('Failed to read news review queue:', err);
    return {
      candidates: [],
      total: 0,
      page,
      pageSize,
      counts,
      generatedAt,
      warning: 'The news review queue could not be read. Check the server logs for details.',
    };
  }
}

export async function applyNewsReviewAction(input: NewsReviewActionInput): Promise<{
  candidate: NewsReviewCandidate | null;
  error: string | null;
}> {
  const client = getClient();
  if (!client) {
    return { candidate: null, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' };
  }

  const now = new Date().toISOString();
  const base: Database['public']['Tables']['news_review_candidates']['Update'] = {
    reviewer_id: input.reviewerId ?? null,
    reviewer_email: input.reviewerEmail ?? null,
    reviewed_at: now,
    updated_at: now,
  };

  if (input.action === 'approve') {
    base.review_status = 'approved';
    base.approved_for_publishing = true;
    base.review_reason = input.reason?.trim() || 'Approved for the established publishing workflow.';
  } else if (input.action === 'reject') {
    base.review_status = 'rejected';
    base.approved_for_publishing = false;
    base.review_reason = input.reason?.trim() || 'Rejected by reviewer.';
  } else if (input.action === 'defer') {
    base.review_status = 'deferred';
    base.approved_for_publishing = false;
    base.review_reason = input.reason?.trim() || 'Deferred for later review.';
  } else if (input.action === 'duplicate') {
    base.review_status = 'duplicate';
    base.approved_for_publishing = false;
    base.review_reason = input.reason?.trim() || 'Marked as duplicate.';
    const slug = input.duplicateOf?.trim();
    if (!slug) {
      return { candidate: null, error: 'An existing story slug is required to mark a duplicate.' };
    }
    const { data: story, error: storyError } = await client
      .from('stories')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle();
    if (storyError) {
      console.error('Failed to validate duplicate story:', storyError);
      return { candidate: null, error: 'Could not validate the existing story.' };
    }
    if (!story) {
      return { candidate: null, error: 'The referenced story does not exist.' };
    }
    base.duplicate_of_slug = slug;
    base.related_story_slug = slug;
  } else {
    return { candidate: null, error: 'Unknown review action.' };
  }

  const { data, error } = await client
    .from('news_review_candidates')
    .update(base)
    .eq('id', input.id)
    .select('*')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      return { candidate: null, error: 'The news_review_candidates table does not exist yet. Apply migration 018.' };
    }
    console.error('Failed to update news review candidate:', error);
    return { candidate: null, error: 'Failed to persist the review decision.' };
  }

  return { candidate: data as NewsReviewCandidate, error: null };
}

