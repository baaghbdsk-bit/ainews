'use server';

import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { DOSSIERS_TAG, dossierTag } from '@/lib/cache-tags';
import { DossierBlocksSchema, type DossierBlock } from '@/lib/dossier/schema';

/**
 * Read-side access to dossiers.
 *
 * The page gets the article plus the resolved source stories in one call, so the
 * renderer can turn a `[n]` marker into a link without a second round trip.
 * Cached: a dossier is the same for every visitor until the generation job
 * revalidates it.
 */

export interface DossierSourceView {
  /** 1-based index matching the `[n]` markers in the blocks. */
  index: number;
  storyId: string;
  slug: string;
  title: string;
  source: string;
  eventDate: string;
  url: string;
}

export interface DossierView {
  slug: string;
  title: string;
  subtitle: string;
  blocks: DossierBlock[];
  generatedAt: string;
  llmModel: string | null;
  sources: DossierSourceView[];
}

interface DossierRow {
  slug: string;
  title: string;
  subtitle: string | null;
  blocks: unknown;
  story_ids: string[];
  llm_model: string | null;
  generated_at: string;
}

interface SourceRow {
  id: string;
  slug: string;
  title: string;
  source: string;
  source_url: string;
  event_date: string;
}

export async function getDossierBySlug(slug: string): Promise<DossierView | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(DOSSIERS_TAG, dossierTag(slug));

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('dossiers')
      .select('slug, title, subtitle, blocks, story_ids, llm_model, generated_at')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch dossier ${slug}:`, error);
      return null;
    }
    if (!data) return null;

    const row = data as unknown as DossierRow;
    const parsed = DossierBlocksSchema.safeParse(row.blocks);
    if (!parsed.success || parsed.data.length === 0) return null;

    const sourceIds = row.story_ids ?? [];
    const sources: DossierSourceView[] = [];

    if (sourceIds.length) {
      const { data: storyRows, error: storyError } = await supabase
        .from('stories')
        .select('id, slug, title, source, source_url, event_date')
        .in('id', sourceIds)
        .eq('status', 'published');

      if (storyError) {
        console.error(`Failed to fetch dossier sources for ${slug}:`, storyError);
      } else {
        const byId = new Map((storyRows as SourceRow[] ?? []).map((story) => [story.id, story]));
        // Preserve the order the writer saw, so [n] always maps to the same story.
        sourceIds.forEach((id, position) => {
          const story = byId.get(id);
          if (!story) return;
          sources.push({
            index: position + 1,
            storyId: story.id,
            slug: story.slug,
            title: story.title,
            source: story.source,
            eventDate: story.event_date,
            url: `/story/${story.slug}`,
          });
        });
      }
    }

    return {
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle ?? '',
      blocks: parsed.data,
      generatedAt: row.generated_at,
      llmModel: row.llm_model,
      sources,
    };
  } catch (err) {
    console.error(`Error fetching dossier ${slug}:`, err);
    return null;
  }
}
