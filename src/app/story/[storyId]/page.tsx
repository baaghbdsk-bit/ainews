import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { ArrowLeft, ArrowUpRight, BookOpen, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { getStoryBySlug, getStoryBySlugFresh, getStoryBySlugPrefix, getUpvoteCount } from "@/lib/actions/stories";
import { getMergedTimeline } from "@/lib/timeline";
import type { Story } from "@/lib/schemas/story";
import { matchEntities } from "@/lib/dossier/entities";
import { stories as seedStories } from "../../stories";
import type { Story as SeedStory } from "../../stories";
import { slugify } from "@/lib/slug";
import { colorForTopic } from "@/lib/story-colors";
import { extractCompany } from "@/lib/story-company";
import { SiteHeader } from "../../site-header";
import { UpvoteButton, BookmarkButton, ShareButton } from "@/components/story-actions";
import { extractStoryAnalytics } from "@/lib/story-stats";
import { StoryStatsDashboard } from "@/components/story-stats-dashboard";
import { extractArticle, type ExtractOutcome } from "@/lib/feeds/extract-article";
import { extractiveSummary } from "@/lib/feeds/summarize";

export const instant = false;

/**
 * Wait for the real page instead of a prerendered fallback.
 *
 * Without it, a slug that is not in the archive is answered with a 200
 * fallback while the page is generated in the background, so a missing story
 * never returns a real 404.
 */
export const ensureStatic = 'navigation';

type StoryPageProps = {
  params: Promise<{ storyId: string }>;
};

/**
 * Generate static params for seed data (for initial deployment)
 */
export function generateStaticParams() {
  return seedStories.map(({ title }) => ({
    storyId: slugify(title),
  }));
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { storyId } = await params;

  // The same resolution the page uses. Calling notFound() here — before the
  // response streams — is what makes a missing story return a real HTTP 404
  // instead of a streamed 200 with a "not found" title. The lookup reads
  // cached data, so it is quick enough to decide before the shell is sent.
  const story = await resolveStory(storyId);
  if (!story) notFound();

  return {
    title: `${story.title} | NeuBench`,
    description: story.summary,
    alternates: { canonical: `/story/${storyId}` },
    openGraph: {
      title: story.title,
      description: story.summary,
      type: "article",
    },
  };
}

/**
 * Format a story for display with computed fields
 */
type DisplayStory = (Story | SeedStory) & {
  slug: string;
  date: string;
  day: string;
  month: string;
  year: string;
  color: string;
  sourceUrl: string;
  imageUrl?: string | null;
  body?: string | null;
  deck?: string | null;
  brief?: string | null;
  key_points?: string[] | null;
  why_it_matters?: string | null;
};

function formatStory(story: Story | SeedStory | null, color: string): DisplayStory | null {
  if (!story) return null;

  const hasEventDate = 'event_date' in story && typeof story.event_date === 'string';
  const hasSourceUrl = 'source_url' in story && typeof story.source_url === 'string';
  const dateStr = hasEventDate ? story.event_date : 'date' in story ? story.date : null;
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const computedSlug =
    'slug' in story && typeof story.slug === 'string' && story.slug
      ? story.slug
      : slugify(story.title);

  const imageUrl = 'image_url' in story && typeof story.image_url === 'string' ? story.image_url : null;

  return {
    ...story,
    slug: computedSlug,
    date: dateStr,
    day: day?.replace(/^0/, "") ?? "",
    month: monthNames[(parseInt(month ?? "", 10) || 1) - 1] ?? "",
    year: year ?? "",
    color,
    sourceUrl: hasSourceUrl ? story.source_url : 'sourceUrl' in story ? story.sourceUrl : "",
    imageUrl,
  };
}


async function persistEnrichedStory(
  storyId: string,
  body: string,
  deck: string,
  keyPoints: string[],
  brief: string | null,
  whyItMatters: string | null,
  imageUrl: string | null,
) {
  try {
    const { supabaseUrl, supabaseServiceRoleKey } = await import('@/lib/env');
    const { createClient } = await import('@supabase/supabase-js');
    const url = supabaseUrl();
    const serviceKey = supabaseServiceRoleKey();
    if (!url || !serviceKey) return;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    await admin
      .from('stories')
      .update({
        body,
        deck: deck || null,
        key_points: keyPoints.length > 0 ? keyPoints : null,
        brief: brief || null,
        why_it_matters: whyItMatters || null,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      })
      .eq('id', storyId);
  } catch {
    // Non-fatal background persistence failure
  }
}

/**
 * Store a story that only existed in the feed.
 *
 * The ingest job runs on a schedule, so a brand new story can be missing from
 * the database for a while - which meant every visit to it re-downloaded
 * every feed. Storing it here, while a reader is already looking at it, means
 * the corpus catches up with real traffic instead of waiting for a scheduler.
 *
 * Best effort: a duplicate (the ingest job got there first) is ignored.
 */
async function persistFeedStory(story: {
  slug: string;
  title: string;
  summary: string;
  significance: string;
  company?: string | null;
  source: string;
  sourceUrl: string;
  imageUrl?: string | null;
  topic: Story['topic'];
  date: string;
}) {
  try {
    const { supabaseUrl, supabaseServiceRoleKey } = await import('@/lib/env');
    const { createClient } = await import('@supabase/supabase-js');
    const url = supabaseUrl();
    const serviceKey = supabaseServiceRoleKey();
    if (!url || !serviceKey) return;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    // Same shape the ingest job writes, so the two paths cannot disagree.
    await admin.from('stories').upsert(
      {
        slug: story.slug,
        title: story.title,
        summary: story.summary,
        significance: story.significance,
        company:
          story.company ??
          extractCompany({ title: story.title, summary: story.summary, source: story.source }) ??
          null,
        source: story.source,
        source_url: story.sourceUrl,
        image_url: story.imageUrl ?? null,
        topic: story.topic,
        event_date: story.date,
        status: 'published',
        published_at: null,
      },
      { onConflict: 'slug', ignoreDuplicates: true },
    );
  } catch {
    // Non-fatal background persistence failure
  }
}

/**
 * Find a story by slug, wherever it lives.
 *
 * The order matters. The database first - it holds the extracted body, the
 * key points and the lead image. Then the same story under a different slug,
 * for when a feed has moved a post's date. Then the curated seeds. Then the
 * merged timeline, which is the one cached copy of the live feeds: reading it
 * is far cheaper than downloading every feed again for a single story.
 */
async function resolveStory(storyId: string): Promise<DisplayStory | null> {
  // 1. The stored row.
  let dbStory: Story | null = null;
  try {
    dbStory = await getStoryBySlug(storyId);
  } catch {
    // Fall through; the timeline below may still have it.
  }
  if (dbStory) return formatStory(dbStory, colorForTopic(dbStory.topic));

  // 2. The same story under a different slug.
  try {
    const prefixStory = await getStoryBySlugPrefix(storyId);
    if (prefixStory) return formatStory(prefixStory, colorForTopic(prefixStory.topic));
  } catch {
    // Fall through.
  }

  // 3. A curated seed story.
  const seedStory = seedStories.find((s) => slugify(s.title) === storyId);
  if (seedStory) return formatStory(seedStory, colorForTopic(seedStory.topic));

  // 4. The merged timeline, which already includes the live feeds. It is the
  //    one cached copy of the feeds, so a lookup here is a cache read rather
  //    than a download of every source - which is what keeps this fast enough
  //    to decide the status before the response streams.
  try {
    const merged = await getMergedTimeline();
    const found = merged.find((s) => s.slug === storyId);
    if (found) {
      // Store it so the corpus catches up with real traffic. `after` runs the
      // write once the response is on its way and the platform waits for it; a
      // bare floating promise is killed when the response completes.
      after(async () => {
        await persistFeedStory({
          slug: found.slug,
          title: found.title,
          summary: found.summary,
          significance: found.significance,
          company: found.company ?? null,
          source: found.source,
          sourceUrl: found.sourceUrl,
          imageUrl: found.imageUrl ?? null,
          topic: found.topic,
          date: found.date,
        });
      });

      return {
        ...found,
        body: null,
        brief: null,
        key_points: found.keyPoints ?? null,
        why_it_matters: found.whyItMatters ?? null,
        deck: found.deck ?? null,
        sourceUrl: found.sourceUrl,
        source: found.source,
        summary: found.summary,
        significance: found.significance,
      } as DisplayStory;
    }
  } catch {
    // Fall through to not-found.
  }

  return null;
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { storyId } = await params;

  // The same resolution the metadata uses, so the two never disagree.
  const storyToRender = await resolveStory(storyId);

  // The row this story was stored as, when there is one, so the enriched
  // content can be written back to it.
  let dbStoryId: string | null = null;
  try {
    const dbStory = await getStoryBySlug(storyId);
    dbStoryId = dbStory?.id ?? null;
  } catch {
    // Not fatal.
  }

  if (!storyToRender) notFound();

  let finalStory: DisplayStory = storyToRender;

  const isSeedStory = seedStories.some((s) => slugify(s.title) === storyId);

  // If the story doesn't have an extracted body yet, extract it on-demand from the source URL
  const hasSubstantialBody =
    'body' in finalStory &&
    typeof finalStory.body === 'string' &&
    finalStory.body.length >= 300;

  if (!isSeedStory && !hasSubstantialBody && finalStory.sourceUrl) {
    try {
      // Race extraction against a strict 2500ms ceiling so visitor connections never hang
      const outcome = await Promise.race([
        extractArticle(finalStory.sourceUrl),
        new Promise<ExtractOutcome>((resolve) =>
          setTimeout(() => resolve({ status: 'unavailable' }), 2500)
        ),
      ]);

      if (outcome.status === 'ok') {
        const enriched = extractiveSummary({
          title: finalStory.title,
          summary: finalStory.summary,
          body: outcome.article.body,
          source: finalStory.source,
          significance: finalStory.significance,
        });

        const resolvedDeck =
          ('deck' in finalStory && typeof finalStory.deck === 'string' && finalStory.deck)
            ? finalStory.deck
            : enriched.deck;
        const resolvedBrief =
          ('brief' in finalStory && typeof finalStory.brief === 'string' && finalStory.brief)
            ? finalStory.brief
            : enriched.brief;
        const resolvedKeyPoints =
          ('key_points' in finalStory && Array.isArray(finalStory.key_points) && finalStory.key_points.length > 0)
            ? finalStory.key_points
            : enriched.keyPoints;
        const resolvedWhyItMatters =
          ('why_it_matters' in finalStory && typeof finalStory.why_it_matters === 'string')
            ? finalStory.why_it_matters
            : enriched.whyItMatters;
        const resolvedImageUrl = finalStory.imageUrl || outcome.article.imageUrl;

        finalStory = {
          ...finalStory,
          body: outcome.article.body,
          deck: resolvedDeck,
          brief: resolvedBrief,
          key_points: resolvedKeyPoints,
          why_it_matters: resolvedWhyItMatters,
          imageUrl: resolvedImageUrl,
        };

        // Persist to Supabase so subsequent visitors load instantly from DB
        const persistedStoryId = dbStoryId;
        if (persistedStoryId) {
          after(async () => {
            await persistEnrichedStory(
              persistedStoryId,
              outcome.article.body,
              resolvedDeck,
              resolvedKeyPoints,
              resolvedBrief,
              resolvedWhyItMatters,
              resolvedImageUrl ?? null,
            );
          });
        }
      }
    } catch (err) {
      console.warn('Failed on-demand article extraction:', err);
    }
  }

  const upvoteCount = await getUpvoteCount(storyToRender.slug);

  return renderStoryPage(finalStory, upvoteCount);
}

function renderStoryPage(story: DisplayStory, upvoteCount: number) {
  const bodyText = "body" in story && typeof story.body === "string" ? story.body : null;
  const bodyParagraphs = bodyText
    ? bodyText.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
    : [];

  const deck = "deck" in story && typeof story.deck === "string" ? story.deck : null;
  const keyPoints =
    "key_points" in story && Array.isArray(story.key_points) ? story.key_points : [];
  const brief = "brief" in story && typeof story.brief === "string" ? story.brief : null;
  const whyItMatters =
    "why_it_matters" in story && typeof story.why_it_matters === "string" ? story.why_it_matters : null;

  // Entities named anywhere in this story, so the reader can jump to the
  // long-form dossier that puts it in context.
  const topics = matchEntities(
    [story.title, deck, brief, whyItMatters, story.summary, bodyText].filter(Boolean).join(" "),
  );

  // The generated brief reads better than raw extracted prose; otherwise show
  // the extracted body, and only fall back to the terse feed summary last.
  const briefParagraphs = brief
    ? brief.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
    : [];
  const proseParagraphs = briefParagraphs.length ? briefParagraphs : bodyParagraphs;

  const totalWords = [story.title, deck, ...proseParagraphs, whyItMatters, ...(keyPoints ?? [])]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .length;
  const readTimeMinutes = Math.max(1, Math.ceil(totalWords / 180));

  const analytics = extractStoryAnalytics({
    title: story.title,
    summary: story.summary,
    body: bodyText,
    deck,
    brief,
    keyPoints,
    whyItMatters,
    topic: story.topic,
  });

  return (
    <main className="site-frame archive-page story-article-page">
      <SiteHeader
        className="story-article-topbar"
        right={
          <div className="header-actions">
            <Link className="story-back-link" href="/">
              <ArrowLeft size={17} />
              <span>Back to timeline</span>
            </Link>
          </div>
        }
      />

      <article className={`story-article article-${story.color}`} data-tour-target="story-page">
        <div className="story-article-meta">
          <span className="story-article-topic">
            <span className={`topic-dot dot-${story.color}`} />
            {story.topic}
          </span>
          <time dateTime={story.date}>
            {story.month} {story.day}, {story.year}
          </time>
          <span className="story-article-readtime">{readTimeMinutes} min read</span>
        </div>

        <h1>{story.title}</h1>

        <div className="story-article-actions">
          <UpvoteButton slug={story.slug} size="md" initialCount={upvoteCount} />
          <BookmarkButton slug={story.slug} size="md" />
          <ShareButton
            title={story.title}
            slug={story.slug}
            summary={story.summary}
            topic={story.topic}
          />
        </div>

        {deck ? <p className="story-article-standfirst">{deck}</p> : null}

        {keyPoints.length ? (
          <aside className="story-article-keypoints" aria-label="Key highlights">
            <h2>Key highlights</h2>
            <ul>
              {keyPoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </aside>
        ) : null}

        {/* ── Visual Stats Grid, Capability Graph & Structured Sections ── */}
        <StoryStatsDashboard analytics={analytics} topicColor={story.color} />

        <div className="story-article-divider">
          <span />
        </div>

        <section className={`story-article-context context-${story.color}`}>
          <div className="story-article-context-header">
            <Sparkles aria-hidden="true" size={16} strokeWidth={2.2} />
            <h2>Why it matters</h2>
          </div>
          <p>{whyItMatters || story.significance}</p>
        </section>

        {topics.length ? (
          <div className="story-article-topics">
            <span>Topic dossiers</span>
            {topics.map((topic) => (
              <Link key={topic.slug} href={`/topic/${topic.slug}`}>
                <Sparkles size={12} /> {topic.label}
              </Link>
            ))}
          </div>
        ) : null}

        <footer className="story-article-source" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} />
            <span>
              Source: <strong>{story.source}</strong>
            </span>
            <a href={story.sourceUrl} rel="noreferrer" target="_blank">
              Read original source <ArrowUpRight size={14} />
            </a>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <BookmarkButton slug={story.slug} size="md" />
            <ShareButton
              title={story.title}
              slug={story.slug}
              summary={story.summary}
              topic={story.topic}
            />
          </div>
        </footer>
      </article>
    </main>
  );
}
