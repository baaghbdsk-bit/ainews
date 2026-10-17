import { FEEDS, loadFeed, AI_NEWS_TAG, type Story } from './fetch-ai-news';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag } from 'next/cache';
import { canonicalizeUrl } from '@/lib/slug';
import { STORIES_TAG } from '@/lib/cache-tags';
import { supabaseServiceRoleKey, supabaseUrl } from '@/lib/env';
import { extractArticle } from './extract-article';
import { summarizeArticle } from './summarize';
import { llmEnabled } from './llm';
import type { Database } from '@/lib/supabase/types';

// A story whose source can't be extracted (bot-blocked, client-rendered,
// paywalled) is retried this many times, then left alone so it can't starve
// the queue.
const ENRICH_RETRY_LIMIT = 3;
// Source pages are fetched in parallel; keep it polite and bounded.
const ENRICH_CONCURRENCY = 5;
// How many stories one run will try to enrich, unless overridden.
const DEFAULT_ENRICH_LIMIT = 25;

// Summaries hit a single provider (the LLM), so keep concurrency at 1 and pace
// requests to stay under free-tier rate limits. Give up on a row after a few
// attempts.
const SUMMARIZE_CONCURRENCY = 1;
const DEFAULT_SUMMARIZE_LIMIT = 25;
const SUMMARY_RETRY_LIMIT = 4;
// Stop a summarize pass after this many consecutive provider (LLM) failures.
const SUMMARY_PROVIDER_FAILURE_LIMIT = 3;
// Minimum gap between LLM calls (default ~13 requests/min, safe for a free tier).
const MIN_LLM_GAP_MS = (() => {
  const raw = Number(process.env.INGEST_SUMMARIZE_GAP_MS);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 4500;
})();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Client = SupabaseClient<Database>;

/** Supabase client used only by the background job. Uses the service role, so
 *  the job can write rows (it bypasses RLS) without any browser key or user. */
function getSupabase(): Client {
  return createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface IngestResult {
  fetched: number;
  newItems: number;
  existing: number;
  enriched: number;
  remaining: number;
  /** Reader-facing summaries generated this run. */
  summarized: number;
  /** Published stories still waiting on a summary. */
  summaryRemaining: number;
  /** True when a source (or the LLM) throttled us; the queue should be retried. */
  rateLimited: boolean;
  errors: string[];
}

export interface IngestOptions {
  /** Skip fetching feeds and only run the article-enrichment pass. */
  enrichOnly?: boolean;
  /** Skip feed fetch and enrichment, and only (re)generate summaries. */
  summarizeOnly?: boolean;
  /** Cap on how many stories this run will try to enrich. */
  enrichLimit?: number;
  /** Cap on how many stories this run will try to summarize. */
  summarizeLimit?: number;
}

function enrichLimitFromEnv(): number {
  const raw = Number(process.env.INGEST_ENRICH_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_ENRICH_LIMIT;
}

function summarizeLimitFromEnv(): number {
  const raw = Number(process.env.INGEST_SUMMARIZE_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_SUMMARIZE_LIMIT;
}

/**
 * Fetch every feed -> normalize -> dedupe against already-published rows ->
 * insert new items -> extract article bodies for rows that still need one ->
 * revalidate the timeline.
 *
 * Free-tier safe: no LLM keys, no paid scheduler. Extraction is a plain fetch +
 * readability pass, and de-duplication is by canonical URL so repeated cron
 * runs are idempotent.
 */
export async function runIngest(options: IngestOptions = {}): Promise<IngestResult> {
  const errors: string[] = [];
  const supabase = getSupabase();

  let fetched = 0;
  let newItems = 0;

  if (!options.enrichOnly && !options.summarizeOnly) {
    // 1. Fetch + normalize every feed into Stories.
    let rawStories: Story[] = [];
    for (const feed of FEEDS) {
      try {
        rawStories = rawStories.concat(await loadFeed(feed));
      } catch (err) {
        errors.push(`Failed to load feed ${feed.name}: ${(err as Error).message}`);
      }
    }

    // 2. Deduplicate across the run (by canonical URL), matching fetchAiNews.
    const seen = new Set<string>();
    const unique: Story[] = [];
    for (const s of rawStories) {
      const key = s.source_url ? canonicalizeUrl(s.source_url) : '';
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }
    fetched = unique.length;

    // 3. Skip anything already published.
    const { data: existing = [], error: queryErr } = await supabase
      .from('stories')
      .select('source_url, slug')
      .eq('status', 'published');
    if (queryErr) {
      errors.push(`Failed to read existing stories: ${queryErr.message}`);
      return {
        fetched,
        newItems: 0,
        existing: 0,
        enriched: 0,
        remaining: 0,
        summarized: 0,
        summaryRemaining: 0,
        rateLimited: false,
        errors,
      };
    }
    const existingUrls = new Set<string>(
      (existing as { source_url: string }[]).map((r) => canonicalizeUrl(r.source_url)),
    );
    const existingSlugs = new Set<string>(
      (existing as { slug: string }[]).map((r) => r.slug),
    );
    const toInsert = unique.filter(
      (s) =>
        !existingUrls.has(canonicalizeUrl(s.source_url)) && !existingSlugs.has(s.slug),
    );

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
    } else {
      newItems = toInsert.length;
    }
  }

  let enriched = 0;
  let remaining = 0;
  let summarized = 0;
  let summaryRemaining = 0;
  let rateLimited = false;

  // 5. Turn thin feed excerpts into real articles for rows that still need one.
  if (!options.summarizeOnly) {
    const enrich = await enrichStories(supabase, options.enrichLimit ?? enrichLimitFromEnv(), errors);
    enriched = enrich.enriched;
    remaining = enrich.remaining;
    rateLimited = rateLimited || enrich.rateLimited;
  }

  // 6. Generate reader-facing summaries (deck / key points / brief) from the
  //    stored body, upgrading extractive decks to LLM ones once a key exists.
  if (!options.enrichOnly) {
    const summary = await summarizeStories(
      supabase,
      options.summarizeLimit ?? summarizeLimitFromEnv(),
      errors,
    );
    summarized = summary.summarized;
    summaryRemaining = summary.remaining;
    rateLimited = rateLimited || summary.rateLimited;
  }

  // 7. Tell the timeline to re-resolve within the hour.
  revalidatePath('/');
  revalidateTag(AI_NEWS_TAG, 'max');
  // The timeline also reads published rows directly (getPublishedStories), which
  // is cached under STORIES_TAG — invalidate it too so new/updated decks show up.
  revalidateTag(STORIES_TAG, 'max');

  return {
    fetched,
    newItems,
    existing: fetched - newItems,
    enriched,
    remaining,
    summarized,
    summaryRemaining,
    rateLimited,
    errors,
  };
}

type PendingRow = { id: string; source_url: string | null; enrich_attempts: number };

async function enrichStories(
  supabase: Client,
  limit: number,
  errors: string[],
): Promise<{ enriched: number; remaining: number; rateLimited: boolean }> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, source_url, enrich_attempts')
    .eq('status', 'published')
    .is('body', null)
    .lt('enrich_attempts', ENRICH_RETRY_LIMIT)
    .not('source_url', 'is', null)
    .order('event_date', { ascending: false })
    .limit(limit);

  if (error) {
    errors.push(`Failed to load enrichment queue: ${error.message}`);
    return { enriched: 0, remaining: 0, rateLimited: false };
  }

  const queue = (data ?? []) as PendingRow[];
  let cursor = 0;
  let enriched = 0;
  let rateLimited = false;

  const worker = async () => {
    while (cursor < queue.length) {
      const row = queue[cursor++];
      if (!row.source_url) continue;

      const outcome = await extractArticle(row.source_url);

      if (outcome.status === 'ok') {
        const { error: updateErr } = await supabase
          .from('stories')
          .update({ body: outcome.article.body })
          .eq('id', row.id);
        if (updateErr) errors.push(`Failed to save body for ${row.id}: ${updateErr.message}`);
        else enriched++;
      } else if (outcome.status === 'rate-limited') {
        // The source is throttling us. Leave the row untouched (do not burn a
        // retry) so a later run can still extract it.
        rateLimited = true;
      } else {
        // Bump the attempt counter so a permanently un-extractable source
        // eventually drops out of the queue.
        const { error: bumpErr } = await supabase
          .from('stories')
          .update({ enrich_attempts: row.enrich_attempts + 1 })
          .eq('id', row.id);
        if (bumpErr) errors.push(`Failed to update attempts for ${row.id}: ${bumpErr.message}`);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(ENRICH_CONCURRENCY, queue.length) }, () => worker()),
  );

  const { count, error: countErr } = await supabase
    .from('stories')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .is('body', null)
    .lt('enrich_attempts', ENRICH_RETRY_LIMIT)
    .not('source_url', 'is', null);
  if (countErr) errors.push(`Failed to count remaining: ${countErr.message}`);

  return { enriched, remaining: count ?? 0, rateLimited };
}

type SummaryRow = {
  id: string;
  title: string;
  summary: string;
  significance: string;
  body: string | null;
  source: string;
  summary_attempts: number;
  llm_model: string | null;
  deck: string | null;
};

/**
 * Generates a reader-facing summary for each story that still needs one. When
 * an LLM API key is configured the LLM writes a deck, key points, a
 * "why it matters" line, and a professional brief grounded on the stored body;
 * otherwise the zero-cost extractive fallback fills `deck`. Rows that already
 * have an extractive deck are re-visited (and upgraded) once a key appears,
 * bounded by `summary_attempts`.
 */
async function summarizeStories(
  supabase: Client,
  limit: number,
  errors: string[],
): Promise<{ summarized: number; remaining: number; rateLimited: boolean }> {
  const llmAvailable = llmEnabled();

  // Without a key every waiting row just needs a deck; with a key, rows whose
  // deck was built by the extractive fallback are eligible for an LLM upgrade.
  const needsSummary = llmAvailable ? 'deck.is.null,llm_model.is.null' : null;

  let queue = supabase
    .from('stories')
    .select('id, title, summary, significance, body, source, summary_attempts, llm_model, deck')
    .eq('status', 'published')
    .lt('summary_attempts', SUMMARY_RETRY_LIMIT);
  queue = needsSummary ? queue.or(needsSummary) : queue.is('deck', null);

  const { data, error } = await queue
    .order('event_date', { ascending: false })
    .limit(limit);

  if (error) {
    errors.push(`Failed to load summary queue: ${error.message}`);
    return { summarized: 0, remaining: 0, rateLimited: false };
  }

  const rows = (data ?? []) as SummaryRow[];
  let cursor = 0;
  let summarized = 0;
  let rateLimited = false;
  // If the LLM provider is unreachable or rejects us, stop early instead of
  // burning every row's retry budget (and DB writes) on it.
  let providerFailures = 0;
  let providerDown = false;
  let lastCallAt = 0;

  const worker = async () => {
    while (cursor < rows.length) {
      if (providerDown) return;
      const row = rows[cursor++];
      if (llmAvailable) {
        const wait = lastCallAt + MIN_LLM_GAP_MS - Date.now();
        if (wait > 0) await sleep(wait);
        lastCallAt = Date.now();
      }
      const outcome = await summarizeArticle({
        title: row.title,
        summary: row.summary,
        significance: row.significance,
        body: row.body,
        source: row.source,
      });
      const now = new Date().toISOString();

      if (outcome.model) {
        const { error: updateErr } = await supabase
          .from('stories')
          .update({
            deck: outcome.deck,
            key_points: outcome.keyPoints,
            why_it_matters: outcome.whyItMatters,
            brief: outcome.brief,
            llm_model: outcome.model,
            llm_generated_at: now,
            summary_attempts: row.summary_attempts + 1,
          })
          .eq('id', row.id);
        if (updateErr) errors.push(`Failed to save summary for ${row.id}: ${updateErr.message}`);
        else summarized++;
        continue;
      }

      if (outcome.rateLimited) {
        // The provider is throttling us. Give the row a fallback deck if it has
        // none, but do NOT bump the attempt counter, so it can still be
        // upgraded to an LLM summary on a later run.
        rateLimited = true;
        if (!row.deck && outcome.deck) {
          const { error: updateErr } = await supabase
            .from('stories')
            .update({ deck: outcome.deck, llm_generated_at: now })
            .eq('id', row.id);
          if (updateErr) errors.push(`Failed to save fallback deck for ${row.id}: ${updateErr.message}`);
        }
        continue;
      }

      if (outcome.providerFailed) {
        // The LLM is enabled but unreachable/rejecting us: this is not the
        // row's fault, so leave its attempt budget alone. Backfill a fallback
        // deck only if the row has none, then stop the pass once the provider
        // is clearly down.
        if (++providerFailures >= SUMMARY_PROVIDER_FAILURE_LIMIT) providerDown = true;
        if (!row.deck && outcome.deck) {
          const { error: updateErr } = await supabase
            .from('stories')
            .update({ deck: outcome.deck, llm_generated_at: now })
            .eq('id', row.id);
          if (updateErr) errors.push(`Failed to save fallback deck for ${row.id}: ${updateErr.message}`);
        }
        if (providerDown) return;
        continue;
      }

      // LLM not in play (no key) or it returned an unusable shape: the
      // extractive fallback stands. Never overwrite a deck we already have;
      // just count the try so a permanently failing row eventually drops out.
      const { error: updateErr } = row.deck
        ? await supabase
            .from('stories')
            .update({ summary_attempts: row.summary_attempts + 1 })
            .eq('id', row.id)
        : await supabase
            .from('stories')
            .update({
              deck: outcome.deck,
              key_points: outcome.keyPoints,
              why_it_matters: outcome.whyItMatters,
              brief: outcome.brief,
              llm_model: null,
              llm_generated_at: now,
              summary_attempts: row.summary_attempts + 1,
            })
            .eq('id', row.id);
      if (updateErr) errors.push(`Failed to save summary for ${row.id}: ${updateErr.message}`);
      else if (!row.deck) summarized++;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(SUMMARIZE_CONCURRENCY, rows.length) }, () => worker()),
  );

  let countQuery = supabase
    .from('stories')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .lt('summary_attempts', SUMMARY_RETRY_LIMIT);
  countQuery = needsSummary ? countQuery.or(needsSummary) : countQuery.is('deck', null);
  const { count, error: countErr } = await countQuery;
  if (countErr) errors.push(`Failed to count summaries remaining: ${countErr.message}`);

  return { summarized, remaining: count ?? 0, rateLimited };
}
