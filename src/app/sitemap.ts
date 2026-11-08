import type { MetadataRoute } from 'next';

import { ENTITIES } from '@/lib/dossier/entities';
import { getCuratedComparisonSlugs } from '@/lib/benchmarks/comparison';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.neubench.workers.dev';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/home`,
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/latest`,
      changeFrequency: 'hourly',
      priority: 0.95,
    },
    {
      url: `${BASE_URL}/trending`,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/benchmarks`,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${BASE_URL}/about`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/connect`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/rss.xml`,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
  ];

  // Programmatic SEO model comparison hubs
  const comparisonSlugs = getCuratedComparisonSlugs();
  for (const slug of comparisonSlugs) {
    entries.push({
      url: `${BASE_URL}/benchmarks/${slug}`,
      changeFrequency: 'weekly',
      priority: 0.85,
    });
  }

  // Entity topic pages (hubs and dossiers share the same URL space).
  for (const entity of ENTITIES) {
    entries.push({
      url: `${BASE_URL}/topic/${entity.slug}`,
      changeFrequency: 'daily',
      priority: 0.75,
    });
  }

  return entries;
}
