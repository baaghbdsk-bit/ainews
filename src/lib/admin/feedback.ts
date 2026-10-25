import { createClient } from '@supabase/supabase-js';
import { hasSupabaseServiceRole, supabaseServiceRoleKey, supabaseUrl } from '@/lib/env';
import { isMissingSchemaError } from '@/lib/supabase/api-guard';
import type { Database } from '@/lib/supabase/types';

export type FeedbackRow = Database['public']['Tables']['feedback_submissions']['Row'];

export interface FeedbackFeed {
  submissions: FeedbackRow[];
  /** Server clock, passed to the client so "last 7 days" is stable across hydration. */
  generatedAt: string;
  warning: string | null;
}

/**
 * Read the feedback inbox with the service role.
 *
 * `015_lock_down_public_writes.sql` revoked reader access to this table, so an
 * anon client cannot see submissions, and should not, since rows may contain
 * a reply address. Callers must already have checked `isAdmin`.
 */
export async function getFeedbackFeed(limit = 500): Promise<FeedbackFeed> {
  const generatedAt = new Date().toISOString();

  if (!hasSupabaseServiceRole()) {
    return {
      submissions: [],
      generatedAt,
      warning:
        'SUPABASE_SERVICE_ROLE_KEY is not configured. Feedback submitted in fallback mode lives only in server memory and cannot be listed here.',
    };
  }

  try {
    const supabase = createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from('feedback_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingSchemaError(error)) {
        return {
          submissions: [],
          generatedAt,
          warning: 'The feedback_submissions table does not exist yet. Apply migration 012.',
        };
      }
      console.error('Failed to read feedback inbox:', error);
      return {
        submissions: [],
        generatedAt,
        warning: 'The feedback table could not be read. Check the server logs for the PostgREST error.',
      };
    }

    return {
      submissions: (data ?? []) as FeedbackRow[],
      generatedAt,
      warning:
        (data?.length ?? 0) >= limit
          ? `Showing the newest ${limit} submissions. Older rows are still in Supabase.`
          : null,
    };
  } catch (err) {
    console.error('Failed to read feedback inbox:', err);
    return {
      submissions: [],
      generatedAt,
      warning: 'The feedback table could not be read. Check the server logs for details.',
    };
  }
}
