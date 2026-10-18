'use server';

import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { CreateStorySchema, UpdateStorySchema, type Story } from '@/lib/schemas/story';
import { cacheLife, cacheTag, revalidatePath, updateTag } from 'next/cache';
import { STORIES_TAG } from '@/lib/cache-tags';
import { isEditor } from '@/lib/auth/editor';
import { extractCompany } from '@/lib/story-company';
import { termPattern } from '@/lib/dossier/entities';

// Only what the timeline projection and the sitemap actually read. Skipping
// body/deck/brief (multi-MB on this table) keeps the public query small enough
// to run on every cold request without dragging ~8MB out of PostgREST.
const PUBLISHED_STORY_COLUMNS =
  'id, slug, title, summary, significance, company, image_url, source, source_url, topic, event_date, published_at, status, updated_at';

/**
 * Fetch all published stories ordered by event_date descending.
 *
 * Cached: published rows are identical for every visitor. The cookie-free
 * client keeps this inside `'use cache'` (the SSR client reads `cookies()`).
 */
export async function getPublishedStories(): Promise<Story[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(STORIES_TAG);

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('stories')
      .select(PUBLISHED_STORY_COLUMNS)
      .eq('status', 'published')
      .order('event_date', { ascending: false });

    if (error) {
      console.error('Failed to fetch published stories:', error);
      return [];
    }

    return data as Story[];
  } catch (err) {
    console.error('Error fetching published stories:', err);
    return [];
  }
}

/**
 * Fetch a single story by slug (public read, published only)
 */
export async function getStoryBySlug(slug: string): Promise<Story | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(STORIES_TAG);

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch story ${slug}:`, error);
      return null;
    }

    return (data as Story | null) ?? null;
  } catch (err) {
    console.error('Error fetching story:', err);
    return null;
  }
}

/**
 * Published stories that mention any of the given terms (title or summary),
 * newest first. Used by the entity hub pages for topics that don't have a
 * long-form dossier yet, so topic chips never lead to a 404.
 */
export async function getStoriesByEntityTerms(terms: string[], limit = 40): Promise<Story[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(STORIES_TAG);

  if (!terms.length) return [];

  try {
    const supabase = createPublicClient();
    // PostgREST needs double-quoted values when the pattern contains a space.
    const filter = terms
      .map((term) => `title.ilike."${termPattern(term)}",summary.ilike."${termPattern(term)}"`)
      .join(',');
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('status', 'published')
      .or(filter)
      .order('event_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch stories by entity terms:', error);
      return [];
    }
    return (data as Story[]) ?? [];
  } catch (err) {
    console.error('Error fetching stories by entity terms:', err);
    return [];
  }
}

/**
 * Fetch a story by ID with full access (requires auth)
 */
export async function getStoryById(id: string): Promise<Story | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch story ${id}:`, error);
      return null;
    }

    return (data as Story | null) ?? null;
  } catch (err) {
    console.error('Error fetching story:', err);
    return null;
  }
}

/**
 * Create a new story (server action for editor)
 */
export async function createStory(input: unknown) {
  try {
    const validatedData = CreateStorySchema.parse(input);
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !isEditor(user)) {
      return { error: 'Unauthorized', data: null };
    }

    const { data, error } = await supabase.from('stories').insert([
      {
        ...validatedData,
        company:
          extractCompany({
            title: validatedData.title,
            summary: validatedData.summary,
            source: validatedData.source,
          }) ?? null,
        created_by: user.id,
        updated_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]).select().single();

    if (error) {
      console.error('Failed to create story:', error);
      return { error: error.message, data: null };
    }

    updateTag(STORIES_TAG);
    revalidatePath('/');
    return { error: null, data: data as Story };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message, data: null };
  }
}

/**
 * Update a story (server action for editor)
 */
export async function updateStory(id: string, input: unknown) {
  try {
    const validatedData = UpdateStorySchema.parse(input);
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !isEditor(user)) {
      return { error: 'Unauthorized', data: null };
    }

    const { data, error } = await supabase
      .from('stories')
      .update({
        ...validatedData,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update story:', error);
      return { error: error.message, data: null };
    }

    // The update returned the full row (body included — the form doesn't
    // carry it), so re-derive company from the post-edit values and persist it
    // only when the edit actually moved it.
    const nextCompany =
      extractCompany({
        title: data.title,
        summary: data.summary,
        body: data.body,
        source: data.source,
      }) ?? null;
    if ((data.company ?? null) !== nextCompany) {
      const { error: companyErr } = await supabase
        .from('stories')
        .update({ company: nextCompany })
        .eq('id', id);
      if (companyErr) console.error('Failed to update company:', companyErr);
      else data.company = nextCompany;
    }

    updateTag(STORIES_TAG);
    revalidatePath('/');
    return { error: null, data: data as Story };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message, data: null };
  }
}

/**
 * Delete a story (server action for editor)
 */
export async function deleteStory(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !isEditor(user)) {
      return { error: 'Unauthorized' };
    }

    const { error } = await supabase.from('stories').delete().eq('id', id);

    if (error) {
      console.error('Failed to delete story:', error);
      return { error: error.message };
    }

    updateTag(STORIES_TAG);
    revalidatePath('/');
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}
