import { type NextRequest } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { AI_NEWS_TAG } from '@/lib/feeds/fetch-ai-news';
import { STORIES_TAG } from '@/lib/cache-tags';
import { bearerMatches, jsonNoStore } from '@/lib/supabase/api-guard';

/**
 * Post-deploy revalidation hook. Protected by a bearer secret so only
 * authorised schedulers (Vercel post-deploy hook / GitHub Actions) can
 * trigger a full HTML + Data Cache purge of the timeline.
 *
 * Call this after every deploy so the prerendered homepage (which captures
 * seed-only data during `next build`) is regenerated with live feeds
 * instead of being served stale from the CDN cache for up to 15 minutes.
 *
 * Example:
 *   curl -H "Authorization: Bearer $REVALIDATE_SECRET" \
 *        https://neubench.vercel.app/api/revalidate
 */
export async function GET(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.error('REVALIDATE_SECRET is not configured; refusing to revalidate.');
    return jsonNoStore({ error: 'Revalidation not configured' }, { status: 500 });
  }

  if (!bearerMatches(request, secret)) {
    return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Purge the CDN/HTML ISR cache for the homepage and story pages.
    revalidatePath('/');
    revalidatePath('/story/[storyId]');
    // Purge the Data Cache entry for the merged timeline.
    revalidateTag(AI_NEWS_TAG, 'max');
    revalidateTag(STORIES_TAG, 'max');

    return jsonNoStore({
      revalidated: true,
      paths: ['/', '/story/[storyId]'],
      tags: [AI_NEWS_TAG, STORIES_TAG],
    });
  } catch (err) {
    console.error('Revalidation failed:', err);
    return jsonNoStore({ error: 'Revalidation failed' }, { status: 500 });
  }
}
