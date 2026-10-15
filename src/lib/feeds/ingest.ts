import { FEEDS, loadFeed, AI_NEWS_TAG, type Story } from './fetch-ai-news';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag } from 'next/cache';

/** Supabase client used only by the background job. Uses the service role, so
 *  the job can write rows (it bypasses RLS) without any browser key or user. */
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      'INGESTION_UNAVAILABLE: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run ingestion',
    );
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface IngestResult {
  fetched: number;
  newItems: number;
  existing: number;
  errors: string[];
}

/**
 * One-shot hourly ingestion: fetch every feed -> normalize -> dedupe against
 * already-published rows -> insert new items -> revalidate the timeline.
 *
 * Free-tier safe: no LLM keys, no paid scheduler. De-duped by source_url so an
 * hourly cron is idempotent.
 */
export async function runIngest(): Promise<IngestResult> {
  const errors: string[] = [];
  const supabase = getSupabase();

  // 1. Fetch + normalize every feed into Stories.
  let rawStories: Story[] = [];
  for (const feed of FEEDS) {
    try {
      rawStories = rawStories.concat(await loadFeed(feed));
    } catch (err) {
      errors.push(`Failed to load feed ${feed.name}: ${(err as Error).message}`);
    }
  }

  // 2. Deduplicate across the run (by URL), matching fetchAiNews exactly.
  const seen = new Set<string>();
  const unique: Story[] = [];
  for (const s of rawStories) {
    if (s.source_url && !seen.has(s.source_url)) {
      seen.add(s.source_url);
      unique.push(s);
    }
  }

  // 3. Skip anything already published.
  const { data: existing = [], error: queryErr } = await supabase
    .from('stories')
    .select('source_url')
    .eq('status', 'published');
  if (queryErr) {
    errors.push(`Failed to read existing stories: ${queryErr.message}`);
    return { fetched: unique.length, newItems: 0, existing: 0, errors };
  }
  const existingUrls = new Set<string>(
    (existing as { source_url: string }[]).map((r) => r.source_url),
  );
  const toInsert = unique.filter((s) => !existingUrls.has(s.source_url));

  // 4. Insert only the new rows (service role bypasses RLS).
  const { error: insertErr } = await supabase.from('stories').insert(
    toInsert.map((s) => ({
      slug: s.slug,
      title: s.title,
      summary: s.summary,
      significance: s.significance,
      source: s.source,
      source_url: s.source_url,
      topic: s.topic,
      event_date: s.event_date,
      status: 'published',
      published_at: s.published_at,
    })),
  );
  if (insertErr) {
    errors.push(`Insert failed: ${insertErr.message}`);
  }

  // 5. Tell the timeline to re-resolve within the hour.
  revalidatePath('/');
  revalidateTag(AI_NEWS_TAG, 'max');

  return {
    fetched: unique.length,
    newItems: toInsert.length,
    existing: unique.length - toInsert.length,
    errors,
  };
}
