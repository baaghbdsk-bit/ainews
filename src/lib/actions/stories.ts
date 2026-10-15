'use server';

import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { CreateStorySchema, UpdateStorySchema, type Story } from '@/lib/schemas/story';
import { cacheLife, cacheTag, revalidatePath, updateTag } from 'next/cache';
import { isEditor } from '@/lib/auth/editor';

/**
 * Fetch all published stories ordered by event_date descending.
 *
 * Cached: published rows are identical for every visitor. The cookie-free
 * client keeps this inside `'use cache'` (the SSR client reads `cookies()`).
 */
export async function getPublishedStories(): Promise<Story[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('stories');

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('stories')
      .select('*')
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
  cacheTag('stories');

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error) {
      console.error(`Failed to fetch story ${slug}:`, error);
      return null;
    }

    return data as Story;
  } catch (err) {
    console.error('Error fetching story:', err);
    return null;
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
      .single();

    if (error) {
      console.error(`Failed to fetch story ${id}:`, error);
      return null;
    }

    return data as Story;
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

    updateTag('stories');
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

    updateTag('stories');
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

    updateTag('stories');
    revalidatePath('/');
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}
