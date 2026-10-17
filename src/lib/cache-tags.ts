/**
 * Shared cache-tag names.
 *
 * Kept in a plain module (not a `'use server'` file, whose exports must be async
 * functions) so both the data layer and the ingest job can import the same
 * literal and stay in sync when invalidating.
 */

/** Invalidation tag for the published-stories query. */
export const STORIES_TAG = 'stories';

/** Invalidation tag for the dossier index/lookup. */
export const DOSSIERS_TAG = 'dossiers';

/** Per-entity cache tag, so regenerating one dossier doesn't drop the rest. */
export function dossierTag(slug: string): string {
  return `dossier:${slug}`;
}
