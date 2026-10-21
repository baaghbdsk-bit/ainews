import { type NextRequest } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ENTITIES, findEntity } from '@/lib/dossier/entities';
import { buildDossier, saveDossier } from '@/lib/dossier/generate';
import { DOSSIERS_TAG, dossierTag } from '@/lib/cache-tags';
import { bearerMatches, jsonNoStore } from '@/lib/supabase/api-guard';

/**
 * Dossier generation trigger. Protected by the same bearer secret as ingest so
 * only an authorised scheduler can fire it.
 *
 *   GET /api/cron/dossier?slug=anthropic
 *
 * Generating a dossier is one (larger) LLM call over that entity's stories, so
 * this is a deliberate, low-frequency job rather than part of the hourly ingest.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === 'change-me') {
    console.error('CRON_SECRET is missing or still the placeholder; refusing to generate a dossier.');
    return jsonNoStore({ error: 'Dossier generation not configured' }, { status: 500 });
  }

  if (!bearerMatches(request, secret)) {
    return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return jsonNoStore({
      ok: false,
      error: 'Missing ?slug',
      entities: ENTITIES.map((entity) => entity.slug),
    }, { status: 400 });
  }

  const entity = findEntity(slug);
  if (!entity) {
    return jsonNoStore({
      ok: false,
      error: `Unknown entity: ${slug}`,
      entities: ENTITIES.map((item) => item.slug),
    }, { status: 404 });
  }

  try {
    const outcome = await buildDossier(entity);

    if (outcome.status !== 'ok') {
      return jsonNoStore({ ok: false, slug, status: outcome.status });
    }

    const saved = await saveDossier(entity, outcome.content, outcome.storyIds, outcome.model);
    if (saved.error) {
      console.error(`Failed to save dossier ${entity.slug}:`, saved.error);
      return jsonNoStore({ ok: false, slug, error: 'Failed to save dossier' }, { status: 500 });
    }

    revalidateTag(dossierTag(entity.slug), 'max');
    revalidateTag(DOSSIERS_TAG, 'max');
    revalidatePath(`/topic/${entity.slug}`);

    return jsonNoStore({
      ok: true,
      slug: entity.slug,
      model: outcome.model,
      blocks: outcome.content.blocks.length,
      sources: outcome.storyIds.length,
      title: outcome.content.title,
    });
  } catch (err) {
    console.error('dossier route failed:', err);
    return jsonNoStore({ ok: false, error: 'Dossier generation failed' }, { status: 500 });
  }
}
