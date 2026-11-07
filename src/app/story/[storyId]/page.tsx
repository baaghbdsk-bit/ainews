import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import { getStoryBySlug, getStoryBySlugPrefix, getUpvoteCount } from '@/lib/actions/stories';
import { stories as seedStories } from '../../stories';
import { slugify } from '@/lib/slug';
import { SiteHeader } from '../../site-header';
import { UpvoteButton, BookmarkButton, ShareButton } from '@/components/story-actions';
import { cleanTitleEditorial } from '@/lib/editorial-overview';
import '@/styles/story-article.css';

type StoryPageProps = {
  params: Promise<{ storyId: string }>;
};

async function resolveStory(storyId: string) {
  if (!storyId || storyId.length > 250) return null;

  // 1. Direct DB lookup
  try {
    const bySlug = await getStoryBySlug(storyId);
    if (bySlug) {
      return {
        id: bySlug.id,
        slug: bySlug.slug,
        title: bySlug.title,
        summary: bySlug.summary,
        body: bySlug.body,
        deck: bySlug.deck,
        significance: bySlug.why_it_matters || bySlug.significance,
        why_it_matters: bySlug.why_it_matters,
        key_points: bySlug.key_points || [],
        source: bySlug.source,
        source_url: bySlug.source_url,
        company: bySlug.company,
        topic: bySlug.topic,
        event_date: bySlug.event_date || (bySlug.published_at ? bySlug.published_at.slice(0, 10) : ''),
      };
    }
  } catch {}

  // 2. Seed stories
  const seed = seedStories.find(
    (s) => s.id === storyId || slugify(s.title) === storyId
  );
  if (seed) {
    return {
      id: seed.id,
      slug: slugify(seed.title),
      title: seed.title,
      summary: seed.summary,
      body: seed.summary,
      deck: seed.summary,
      significance: seed.significance,
      why_it_matters: seed.significance,
      key_points: [] as string[],
      source: seed.source,
      source_url: seed.sourceUrl,
      company: seed.company,
      topic: seed.topic,
      event_date: seed.date,
    };
  }

  // 3. Slug prefix lookup (for truncated URLs)
  try {
    const byPrefix = await getStoryBySlugPrefix(storyId);
    if (byPrefix) {
      return {
        id: byPrefix.id,
        slug: byPrefix.slug,
        title: byPrefix.title,
        summary: byPrefix.summary,
        body: byPrefix.body,
        deck: byPrefix.deck,
        significance: byPrefix.why_it_matters || byPrefix.significance,
        why_it_matters: byPrefix.why_it_matters,
        key_points: byPrefix.key_points || [],
        source: byPrefix.source,
        source_url: byPrefix.source_url,
        company: byPrefix.company,
        topic: byPrefix.topic,
        event_date: byPrefix.event_date || '',
      };
    }
  } catch {}

  return null;
}

export function generateStaticParams() {
  return seedStories.map(({ title }) => ({
    storyId: slugify(title),
  }));
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { storyId } = await params;
  const story = await resolveStory(storyId);
  if (!story) notFound();

  const title = cleanTitleEditorial(story.title) || 'AI Dispatch';
  const desc = story.summary || story.deck || 'Read the full intelligence analysis on NeuBench.';

  return {
    title: `${title} | NeuBench`,
    description: desc,
    alternates: {
      canonical: `/story/${storyId}`,
    },
    openGraph: {
      title,
      description: desc,
      type: 'article',
      url: `/story/${storyId}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
    },
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { storyId } = await params;
  const story = await resolveStory(storyId);
  if (!story) {
    notFound();
  }

  const cleanTitle = cleanTitleEditorial(story.title);
  const cleanSummary = story.summary || story.body || '';
  const upvoteCount = await getUpvoteCount(story.slug).catch(() => 0);

  return (
    <main className="site-frame story-article-page">
      <SiteHeader className="story-article-topbar" />

      <article className="story-article">
        <div className="story-article-meta">
          <Link href="/explore?view=latest" className="story-back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', marginRight: 12 }}>
            <ArrowLeft size={14} />
            <span>Timeline</span>
          </Link>
          {story.topic && (
            <span className="story-article-topic">
              {story.topic}
            </span>
          )}
          {story.event_date && (
            <time dateTime={story.event_date}>{story.event_date}</time>
          )}
          {story.company && (
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{story.company}</span>
          )}
        </div>

        <h1>{cleanTitle}</h1>

        <div className="story-article-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 28px' }}>
          <UpvoteButton slug={story.slug} initialCount={upvoteCount} />
          <BookmarkButton slug={story.slug} />
          <ShareButton title={cleanTitle} slug={story.slug} topic={story.topic} />
        </div>

        {cleanSummary && (
          <div className="story-article-body">
            <p className="story-article-standfirst">{cleanSummary}</p>
          </div>
        )}

        {story.key_points && story.key_points.length > 0 && (
          <aside className="story-article-keypoints" style={{ margin: '28px 0', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--fg)' }}>Key Takeaways</h2>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
              {story.key_points.map((pt, idx) => (
                <li key={idx} style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>{pt}</li>
              ))}
            </ul>
          </aside>
        )}

        {story.why_it_matters && (
          <section className="story-article-context" style={{ margin: '28px 0', padding: '20px', background: 'rgba(253, 224, 71, 0.04)', borderRadius: 12, border: '1px solid rgba(253, 224, 71, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--accent)', fontWeight: 700, fontSize: '0.95rem' }}>
              <Sparkles size={16} />
              <span>Why It Matters</span>
            </div>
            <p style={{ margin: 0, color: 'var(--fg)', fontSize: '0.95rem', lineHeight: 1.6 }}>{story.why_it_matters}</p>
          </section>
        )}

        <footer className="story-article-source" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
            <BookOpen size={16} style={{ color: 'var(--muted)' }} />
            <span>
              Source: <strong style={{ color: 'var(--fg)' }}>{story.source || story.company || 'Primary Lab'}</strong>
            </span>
            {story.source_url && (
              <a
                href={story.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', marginLeft: 8, textDecoration: 'none', fontWeight: 600 }}
              >
                <span>Read Original</span>
                <ArrowUpRight size={14} />
              </a>
            )}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <BookmarkButton slug={story.slug} />
            <ShareButton title={cleanTitle} slug={story.slug} topic={story.topic} />
          </div>
        </footer>
      </article>
    </main>
  );
}
