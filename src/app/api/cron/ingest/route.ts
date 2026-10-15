import { type NextRequest, NextResponse } from 'next/server';
import { runIngest } from '@/lib/feeds/ingest';
import { AI_NEWS_TAG } from '@/lib/feeds/fetch-ai-news';

/**
 * Background ingest trigger. Protected by a bearer secret so only an authorised
 * scheduler (GitHub Actions / n8n) can fire it.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runIngest();
    return NextResponse.json({ ok: true, ...result, tag: AI_NEWS_TAG });
  } catch (err) {
    console.error('ingest route failed:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
