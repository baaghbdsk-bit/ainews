import { type NextRequest, NextResponse } from 'next/server';
import { runIngest } from '@/lib/feeds/ingest';
import { AI_NEWS_TAG } from '@/lib/feeds/fetch-ai-news';

/**
 * Background ingest trigger. Protected by a bearer secret so only an authorised
 * scheduler (GitHub Actions / n8n) can fire it.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === 'change-me') {
    console.error('CRON_SECRET is missing or still the placeholder; refusing to run ingest.');
    return NextResponse.json({ error: 'Ingest not configured' }, { status: 500 });
  }

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;

  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // `?mode=enrich` skips the feed fetch and only extracts article bodies, and
  // `?mode=summarize` only (re)generates reader-facing summaries, so the
  // scheduler can drain a backlog with repeated cheap calls.
  //
  // `?summarizeLimit=N` raises the per-call batch (bounded here) so a one-off
  // backfill can drain faster without changing the scheduled defaults.
  const mode = request.nextUrl.searchParams.get('mode');
  const requestedLimit = Number(request.nextUrl.searchParams.get('summarizeLimit'));
  const summarizeLimit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), 500)
      : undefined;

  try {
    const result = await runIngest({
      enrichOnly: mode === 'enrich',
      summarizeOnly: mode === 'summarize',
      summarizeLimit,
    });
    return NextResponse.json({ ok: true, ...result, tag: AI_NEWS_TAG });
  } catch (err) {
    console.error('ingest route failed:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
