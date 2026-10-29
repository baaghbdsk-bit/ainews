import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://neubench.netlify.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
      // GEO & AEO: Explicitly permit AI engines and search synthesis bots
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'ClaudeBot',
          'PerplexityBot',
          'Google-Extended',
          'Applebot-Extended',
          'Amazonbot',
        ],
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
