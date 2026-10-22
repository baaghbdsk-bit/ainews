'use server';

import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { CreateStorySchema, UpdateStorySchema, type Story } from '@/lib/schemas/story';
import { ZodError } from 'zod';
import { cacheLife, cacheTag, revalidatePath, updateTag } from 'next/cache';
import { STORIES_TAG } from '@/lib/cache-tags';
import { isEditor } from '@/lib/auth/editor';
import { extractCompany } from '@/lib/story-company';
import { termPattern } from '@/lib/dossier/entities';
import { slugTitlePart } from '@/lib/slug';
import { isMissingSchemaError } from '@/lib/supabase/api-guard';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

// Only what the timeline projection and the sitemap actually read. Skipping
// body/brief (multi-MB on this table) keeps the public query fast while including
// lightweight editorial decks and takeaways.
const PUBLISHED_STORY_COLUMNS =
  'id, slug, title, summary, significance, deck, key_points, why_it_matters, company, image_url, source, source_url, topic, event_date, published_at, status, updated_at';

/** Rows per page when reading the archive. PostgREST returns at most this
 *  many rows in one response, so the read has to be paged. */
const STORY_PAGE_SIZE = 1000;

/**
 * Fetch all published stories ordered by event_date descending.
 *
 * Cached: published rows are identical for every visitor. The cookie-free
 * client keeps this inside `'use cache'` (the SSR client reads `cookies()`).
 *
 * The read is paged. PostgREST caps a single response at a thousand rows
 * whatever the limit asks for, so one un-paged request quietly returned only
 * the most recent thousand stories and the rest of the archive was invisible.
 * The second sort column keeps the order stable across pages, so a row
 * cannot be skipped or repeated at a boundary.
 */
export async function getPublishedStories(): Promise<Story[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(STORIES_TAG);

  try {
    const supabase = createPublicClient();
    const rows: Story[] = [];

    for (let offset = 0; ; offset += STORY_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('stories')
        .select(PUBLISHED_STORY_COLUMNS)
        .eq('status', 'published')
        .order('event_date', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + STORY_PAGE_SIZE - 1);

      if (error) {
        console.error('Failed to fetch published stories:', error);
        // Keep whatever was read before the failure rather than losing the
        // whole archive.
        break;
      }

      rows.push(...((data ?? []) as Story[]));
      if (!data || data.length < STORY_PAGE_SIZE) break;
    }

    return rows;
  } catch (err) {
    console.error('Error fetching published stories:', err);
    return [];
  }
}

type StoryWithVotes = Story & { upvote_count: number };

interface VoteCountRow {
  story_slug: string;
  upvote_count: number;
}

const voteCountsClient = (): SupabaseClient =>
  createSupabaseClient(supabaseUrl(), supabaseAnonKey());

/**
 * Current upvote totals per story slug, read from the aggregate vote table.
 * A missing table degrades to an empty map instead of failing the page.
 */
export async function getUpvoteCounts(): Promise<Record<string, number>> {
  'use cache';
  cacheLife('minutes');

  const counts: Record<string, number> = {};

  try {
    const { data, error } = await voteCountsClient()
      .from('story_vote_counts')
      .select('story_slug, upvote_count');

    if (error) {
      if (!isMissingSchemaError(error)) {
        console.error('Failed to fetch upvote counts:', error);
      }
      return counts;
    }

    for (const row of (data ?? []) as VoteCountRow[]) {
      counts[row.story_slug] = row.upvote_count;
    }
  } catch (err) {
    console.error('Error fetching upvote counts:', err);
  }

  return counts;
}

/** The upvote total for one story. Zero when the story has never been voted on. */
export async function getUpvoteCount(slug: string): Promise<number> {
  'use cache';
  cacheLife('minutes');

  const counts = await getUpvoteCounts();
  return counts[slug] ?? 0;
}

/** The published stories with their current upvote total attached. */
export async function getPublishedStoriesWithVotes(): Promise<StoryWithVotes[]> {
  const [stories, counts] = await Promise.all([getPublishedStories(), getUpvoteCounts()]);

  return stories.map((story) => ({
    ...story,
    upvote_count: counts[story.slug] ?? 0,
  }));
}

/**
 * Fetch a single story by slug (public read, published only)
 */
export async function getStoryBySlug(slug: string): Promise<Story | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag(STORIES_TAG);

  return queryStoryBySlug(slug);
}

/**
 * The same lookup, but never served from the cache.
 *
 * Kept for the rare case where a caller needs the current state of a row
 * rather than the cached one. The article page does not use it: the route has
 * to stay fully static, and a cached miss costs at most a minute, which the
 * background write covers.
 */
export async function getStoryBySlugFresh(slug: string): Promise<Story | null> {
  return queryStoryBySlug(slug);
}

async function queryStoryBySlug(slug: string): Promise<Story | null> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      // While a route is being prerendered the platform tears the request
      // down, and the read fails with a message about the prerender being
      // complete. That is expected, not a fault worth logging.
      if (!/prerender/i.test(error.message ?? '')) {
        console.error(`Failed to fetch story ${slug}:`, error);
      }
      return null;
    }

    return (data as Story | null) ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/prerender/i.test(message)) {
      console.error('Error fetching story:', err);
    }
    return null;
  }
}

/**
 * Fetch a story whose slug differs only in its date or hash component.
 *
 * A feed that revises a title, or a post whose publication date moves, mints a
 * new slug for a story that is already stored. Matching on the title part
 * finds the stored row - and with it the extracted body, key points and lead
 * image - instead of falling through to re-fetching every feed.
 */
export async function getStoryBySlugPrefix(slug: string): Promise<Story | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag(STORIES_TAG);

  const prefix = slugTitlePart(slug);
  if (!prefix || prefix === slug) return null;

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .like('slug', `${prefix}-%`)
      .eq('status', 'published')
      .order('event_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (!isMissingSchemaError(error)) {
        console.error(`Failed to fetch story by prefix ${prefix}:`, error);
      }
      return null;
    }

    return (data as Story | null) ?? null;
  } catch (err) {
    console.error('Error fetching story by prefix:', err);
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
      return { error: 'Failed to create story', data: null };
    }

    updateTag(STORIES_TAG);
    revalidatePath('/');
    return { error: null, data: data as Story };
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message ?? 'Invalid story data', data: null };
    }
    console.error('Error creating story:', err);
    return { error: 'Failed to create story', data: null };
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
      return { error: 'Failed to update story', data: null };
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
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message ?? 'Invalid story data', data: null };
    }
    console.error('Error updating story:', err);
    return { error: 'Failed to update story', data: null };
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
      return { error: 'Failed to delete story' };
    }

    updateTag(STORIES_TAG);
    revalidatePath('/');
    return { error: null };
  } catch (err) {
    console.error('Error deleting story:', err);
    return { error: 'Failed to delete story' };
  }
}
