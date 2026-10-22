import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { jsonNoStore, zodDetails } from '@/lib/supabase/api-guard';
import { getSessionUser } from '@/lib/auth/session-server';

const SlugSchema = z.string().trim().min(1).max(200);
const BodySchema = z.union([
  z.object({ slug: SlugSchema }),
  z.object({ slugs: z.array(SlugSchema).min(1).max(500) }),
]);

function slugsOf(body: z.infer<typeof BodySchema>): string[] {
  return 'slug' in body ? [body.slug] : [...new Set(body.slugs)];
}

/**
 * Saved stories for a signed-in reader.
 *
 * The request is made with the reader's own session, so the row-level
 * security policies decide what it may read and write - a reader can only
 * ever touch their own saved stories. Guests keep theirs on the device.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return jsonNoStore({ error: 'Sign in to sync saved stories' }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('story_bookmarks')
      .select('story_slug')
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to read bookmarks:', error);
      return jsonNoStore({ error: 'Failed to load saved stories' }, { status: 500 });
    }

    return jsonNoStore({ slugs: (data ?? []).map((row) => row.story_slug as string) });
  } catch (err) {
    console.error('Bookmarks GET error:', err);
    return jsonNoStore({ error: 'Failed to load saved stories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return jsonNoStore({ error: 'Sign in to save stories' }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonNoStore(
      { error: 'Invalid request body', details: zodDetails(parsed.error) },
      { status: 400 },
    );
  }

  const slugs = slugsOf(parsed.data);

  try {
    const supabase = await createClient();
    // A bulk save is how a guest's saved stories move onto the account after
    // sign-in, so the whole local set lands in one round trip.
    const { error } = await supabase
      .from('story_bookmarks')
      .upsert(
        slugs.map((story_slug) => ({ story_slug, user_id: user.id })),
        { onConflict: 'story_slug,user_id', ignoreDuplicates: true },
      );

    if (error) {
      console.error('Failed to save bookmarks:', error);
      return jsonNoStore({ error: 'Failed to save story' }, { status: 500 });
    }

    return jsonNoStore({ ok: true, slugs });
  } catch (err) {
    console.error('Bookmarks POST error:', err);
    return jsonNoStore({ error: 'Failed to save story' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return jsonNoStore({ error: 'Sign in to manage saved stories' }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonNoStore(
      { error: 'Invalid request body', details: zodDetails(parsed.error) },
      { status: 400 },
    );
  }

  const slugs = slugsOf(parsed.data);

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('story_bookmarks')
      .delete()
      .in('story_slug', slugs)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to remove bookmarks:', error);
      return jsonNoStore({ error: 'Failed to remove story' }, { status: 500 });
    }

    return jsonNoStore({ ok: true, slugs });
  } catch (err) {
    console.error('Bookmarks DELETE error:', err);
    return jsonNoStore({ error: 'Failed to remove story' }, { status: 500 });
  }
}
