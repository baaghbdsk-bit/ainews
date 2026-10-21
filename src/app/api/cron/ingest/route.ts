import { type NextRequest } from 'next/server';
import { runIngest } from '@/lib/feeds/ingest';
import { AI_NEWS_TAG } from '@/lib/feeds/fetch-ai-news';
import { bearerMatches, jsonNoStore } from '@/lib/supabase/api-guard';

/**
 * Background ingest trigger. Protected by a bearer secret so only an authorised
 * scheduler (GitHub Actions / n8n) can fire it.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === 'change-me') {
    console.error('CRON_SECRET is missing or still the placeholder; refusing to run ingest.');
    return jsonNoStore({ error: 'Ingest not configured' }, { status: 500 });
  }

  if (!bearerMatches(request, secret)) {
    return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
  }

  // `?mode=enrich` skips the feed fetch and only extracts article bodies,
  // `?mode=summarize` only (re)generates reader-facing summaries, and
  // `?mode=images` only fills missing lead images, so the scheduler (or a
  // one-off backfill) can drain a backlog with repeated cheap calls.
  //
  // `?summarizeLimit=N` / `?imagesLimit=N` raise the per-call batch (bounded
  // here) so a one-off backfill can drain faster without changing the scheduled
  // defaults.
  const mode = request.nextUrl.searchParams.get('mode');
  const requestedSummarize = Number(request.nextUrl.searchParams.get('summarizeLimit'));
  const summarizeLimit =
    Number.isFinite(requestedSummarize) && requestedSummarize > 0
      ? Math.min(Math.floor(requestedSummarize), 500)
      : undefined;
  const requestedImages = Number(request.nextUrl.searchParams.get('imagesLimit'));
  const imagesLimit =
    Number.isFinite(requestedImages) && requestedImages > 0
      ? Math.min(Math.floor(requestedImages), 500)
      : undefined;

  try {
    const result = await runIngest({
      enrichOnly: mode === 'enrich',
      summarizeOnly: mode === 'summarize',
      imagesOnly: mode === 'images',
      summarizeLimit,
      imagesLimit,
    });
    return jsonNoStore({ ok: true, ...result, tag: AI_NEWS_TAG });
  } catch (err) {
    console.error('ingest route failed:', err);
    return jsonNoStore({ ok: false, error: 'Ingest failed' }, { status: 500 });
  }
}
