import { getTimelinePage } from '@/lib/timeline';

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.neubench.workers.dev';

  let stories: Array<{
    id?: string;
    slug?: string;
    title?: string;
    summary?: string;
    topic?: string;
    source?: string;
    sourceUrl?: string;
    formattedDate?: string;
    year?: string;
    month?: string;
    day?: string;
  }> = [];

  try {
    const page = await getTimelinePage({}, 0, 50);
    stories = page.stories || [];
  } catch (err) {
    console.error('Failed to load stories for RSS feed:', err);
  }

  const itemsXml = stories
    .map((story) => {
      const pubDate =
        story.year && story.month && story.day
          ? new Date(`${story.year}-${story.month}-${story.day}T12:00:00Z`).toUTCString()
          : new Date().toUTCString();
      const storyUrl = story.sourceUrl || `${siteUrl}/latest?search=${encodeURIComponent(story.title || '')}`;
      const title = (story.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const summary = (story.summary || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const source = (story.source || 'NeuBench').replace(/&/g, '&amp;');

      return `    <item>
      <title>${title}</title>
      <link>${storyUrl}</link>
      <guid isPermaLink="true">${storyUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${summary}</description>
      <category>${story.topic || 'Artificial Intelligence'}</category>
      <source url="${story.sourceUrl || storyUrl}">${source}</source>
    </item>`;
    })
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>NeuBench — Real-Time AI News &amp; Intelligence Radar</title>
    <link>${siteUrl}</link>
    <description>The one-stop destination for real-time AI news, breakthroughs, frontier research, and model releases.</description>
    <language>en-us</language>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=1800',
    },
  });
}
