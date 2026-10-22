'use server';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/env';
import { getSessionUser } from '@/lib/auth/session-server';
import { revalidateTag } from 'next/cache';
import { STORIES_TAG } from '@/lib/cache-tags';

/**
 * Move a guest's votes onto the account they just signed in to.
 *
 * Votes are recorded against a client id. A guest votes under a local token;
 * once signed in the reader votes under their user id. If both rows are left
 * in place the same person is counted twice on the same story, because the
 * aggregate is a row count. This moves them: the guest's rows are replaced by
 * the account's rows and the totals are recounted.
 *
 * Best effort - a failure here must never block the sign-in itself.
 */
export async function claimGuestVotes(guestClientId: string): Promise<number> {
  if (!guestClientId) return 0;

  try {
    const user = await getSessionUser();
    if (!user) return 0;
    // Nothing to move if the votes are already recorded against the account.
    if (guestClientId === user.id) return 0;

    const admin = adminClient();
    if (!admin) return 0;

    const { data: guestVotes, error: readErr } = await admin
      .from('story_upvotes')
      .select('story_slug')
      .eq('client_id', guestClientId);
    if (readErr || !guestVotes?.length) return 0;

    const slugs = [...new Set(guestVotes.map((v) => v.story_slug as string))];
    const { data: ownVotes } = await admin
      .from('story_upvotes')
      .select('story_slug')
      .eq('client_id', user.id);
    const alreadyOwn = new Set((ownVotes ?? []).map((v) => v.story_slug as string));

    // Rows the account does not have yet.
    const toAdd = slugs.filter((slug) => !alreadyOwn.has(slug));
    if (toAdd.length) {
      await admin
        .from('story_upvotes')
        .insert(toAdd.map((story_slug) => ({ story_slug, client_id: user.id })));
    }

    // The guest's rows go, so the reader is counted once.
    await admin.from('story_upvotes').delete().eq('client_id', guestClientId);

    for (const slug of slugs) {
      const { count } = await admin
        .from('story_upvotes')
        .select('id', { count: 'exact', head: true })
        .eq('story_slug', slug);
      await admin.from('story_vote_counts').upsert({
        story_slug: slug,
        upvote_count: count ?? 0,
        updated_at: new Date().toISOString(),
      });
    }

    revalidateTag(STORIES_TAG, 'max');
    return slugs.length;
  } catch {
    return 0;
  }
}

function adminClient(): SupabaseClient | null {
  try {
    const url = supabaseUrl();
    const key = supabaseServiceRoleKey();
    if (!url || !key) return null;
    return createSupabaseClient(url, key, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}
