import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonNoStore, zodDetails } from '@/lib/supabase/api-guard';
import { getTimelineStoriesBySlugs } from '@/lib/timeline';

const RequestSchema = z.object({
  slugs: z.array(z.string().trim().min(1).max(200)).min(1).max(500),
});

export async function POST(request: NextRequest) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonNoStore(
      { error: 'Invalid request body', details: zodDetails(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const stories = await getTimelineStoriesBySlugs(parsed.data.slugs);
    return jsonNoStore({ stories });
  } catch (error) {
    console.error('Failed to load saved stories:', error);
    return jsonNoStore({ error: 'Failed to load saved stories' }, { status: 500 });
  }
}
