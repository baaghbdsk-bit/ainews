import type { MetadataRoute } from 'next';
import { getPublishedStories } from '@/lib/actions/stories';
import { ENTITIES } from '@/lib/dossier/entities';

const BASE_URL = 'https://ainews-smel.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: 'hourly',
      priority: 1,
    },
  ];

  // Entity topic pages (hubs and dossiers share the same URL space).
  for (const entity of ENTITIES) {
    entries.push({
      url: `${BASE_URL}/topic/${entity.slug}`,
      changeFrequency: 'daily',
      priority: 0.6,
    });
  }

  try {
    const stories = await getPublishedStories();
    for (const story of stories) {
      entries.push({
        url: `${BASE_URL}/story/${story.slug}`,
        lastModified: story.updated_at ?? undefined,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch {
    // Supabase unavailable — the static entries above still ship.
  }

  return entries;
}
