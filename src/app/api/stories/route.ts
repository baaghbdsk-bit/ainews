import type { NextRequest } from 'next/server';
import { getTimelinePage } from '@/lib/timeline';
import { PAGE_SIZE, type TimelineFilters } from '@/lib/timeline-shared';

/**
 * Paginated, filtered timeline window.
 *
 *   GET /api/stories?topic=Models&year=2026&month=10&company=OpenAI&q=agent&offset=60&limit=60
 *
 * The browser holds at most one page of stories; every filter/search change
 * and every infinite-scroll step comes through here against the same cached
 * merge the server-rendered first page uses.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const readInt = (name: string, fallback: number, min: number, max: number): number => {
    const raw = Number.parseInt(params.get(name) ?? '', 10);
    if (Number.isNaN(raw)) return fallback;
    return Math.min(max, Math.max(min, raw));
  };

  const filters: TimelineFilters = {
    topic: params.get('topic') ?? undefined,
    year: params.get('year') ?? undefined,
    month: params.get('month') ?? undefined,
    company: params.get('company') ?? undefined,
    q: params.get('q') ?? undefined,
  };

  const offset = readInt('offset', 0, 0, 1_000_000);
  const limit = readInt('limit', PAGE_SIZE, 1, 200);

  try {
    const page = await getTimelinePage(filters, offset, limit);
    // Edge-cache filtered windows for a minute so repeated scrolls/filters are
    // served from the CDN instead of re-merging on a serverless instance; the
    // stale window lets the edge refresh in the background. Errors below are
    // never cached.
    return Response.json(page, {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('Failed to load timeline page:', err);
    return Response.json({ error: 'Failed to load stories' }, { status: 500 });
  }
}
