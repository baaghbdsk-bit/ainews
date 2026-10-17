import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ENTITIES, findEntity } from '@/lib/dossier/entities';
import { buildDossier, saveDossier } from '@/lib/dossier/generate';
import { DOSSIERS_TAG, dossierTag } from '@/lib/cache-tags';

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
    return NextResponse.json({ error: 'Dossier generation not configured' }, { status: 500 });
  }

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;

  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({
      ok: false,
      error: 'Missing ?slug',
      entities: ENTITIES.map((entity) => entity.slug),
    }, { status: 400 });
  }

  const entity = findEntity(slug);
  if (!entity) {
    return NextResponse.json({
      ok: false,
      error: `Unknown entity: ${slug}`,
      entities: ENTITIES.map((item) => item.slug),
    }, { status: 404 });
  }

  try {
    const outcome = await buildDossier(entity);

    if (outcome.status !== 'ok') {
      return NextResponse.json({ ok: false, slug, status: outcome.status }, { status: 200 });
    }

    const saved = await saveDossier(entity, outcome.content, outcome.storyIds, outcome.model);
    if (saved.error) {
      return NextResponse.json({ ok: false, slug, error: saved.error }, { status: 500 });
    }

    revalidateTag(dossierTag(entity.slug), 'max');
    revalidateTag(DOSSIERS_TAG, 'max');
    revalidatePath(`/topic/${entity.slug}`);

    return NextResponse.json({
      ok: true,
      slug: entity.slug,
      model: outcome.model,
      blocks: outcome.content.blocks.length,
      sources: outcome.storyIds.length,
      title: outcome.content.title,
    });
  } catch (err) {
    console.error('dossier route failed:', err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
