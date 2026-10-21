import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { getStoryBySlug, getStoryBySlugFresh, getStoryBySlugPrefix, getUpvoteCount } from "@/lib/actions/stories";
import { fetchAiNews } from "@/lib/feeds/fetch-ai-news";
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

  // Mirror the page's lookup chain (db → db-by-prefix → seed → live). Calling
  // notFound() here — before the response streams — is what makes a missing
  // story return a real HTTP 404 instead of a streamed 200 with a "not found"
  // title.
  let dbStory: Story | null = null;
  try {
    dbStory = await getStoryBySlug(storyId);
  } catch {
    // During prerendering, Supabase may not be available; fall through.
  }
  if (!dbStory) {
    try {
      dbStory = await getStoryBySlugFresh(storyId);
    } catch {
      // Non-fatal; the feed fallback still applies.
    }
  }
  if (!dbStory) {
    try {
      dbStory = await getStoryBySlugPrefix(storyId);
    } catch {
      // Non-fatal; the seed and feed fallbacks still apply.
    }
  }
  if (dbStory) {
    return {
      title: `${dbStory.title} | NeuBench`,
      description: dbStory.summary,
      alternates: { canonical: `/story/${storyId}` },
      openGraph: {
        title: dbStory.title,
        description: dbStory.summary,
        type: "article",
      },
    };
  }

  const seedStory = seedStories.find((s) => slugify(s.title) === storyId);
  if (seedStory) {
    return {
      title: `${seedStory.title} | NeuBench`,
      description: seedStory.summary,
      alternates: { canonical: `/story/${storyId}` },
      openGraph: {
        title: seedStory.title,
        description: seedStory.summary,
        type: "article",
      },
    };
  }

  try {
    const live = (await fetchAiNews()).find((s) => s.slug === storyId);
    if (live) {
      return {
        title: `${live.title} | NeuBench`,
        description: live.summary,
        alternates: { canonical: `/story/${storyId}` },
        openGraph: {
          title: live.title,
          description: live.summary,
          type: "article",
        },
      };
    }
  } catch {
    // Feed unavailable; fall through to notFound.
  }

  notFound();
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
async function persistFeedStory(story: Story) {
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
        source_url: story.source_url,
        image_url: story.image_url ?? null,
        topic: story.topic,
        event_date: story.event_date,
        status: 'published',
        published_at: story.published_at ?? null,
      },
      { onConflict: 'slug', ignoreDuplicates: true },
    );
  } catch {
    // Non-fatal background persistence failure
  }
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { storyId } = await params;

  let dbStory: Story | null = null;
  try {
    dbStory = await getStoryBySlug(storyId);
    // A cached miss can be stale: the story may have been stored a moment ago
    // by the ingest job, or by the reader who opened it. Re-read it directly
    // before giving up on the database.
    if (!dbStory) dbStory = await getStoryBySlugFresh(storyId);
  } catch {
    // During prerendering, Supabase may not be available — fall back below.
  }

  let storyToRender: DisplayStory | null = null;

  // 1. Persisted / ingested story
  if (dbStory) {
    storyToRender = formatStory(dbStory, colorForTopic(dbStory.topic));
  } else {
    // 2. The same story under a different slug. A feed that revises a title
    //    or moves a publication date mints a new slug for a story that is
    //    already stored, so match on the title part before falling back to
    //    the feed. This is the difference between a 10ms page and a 4s one:
    //    the feed fallback re-downloads every source.
    let prefixStory: Story | null = null;
    try {
      prefixStory = await getStoryBySlugPrefix(storyId);
    } catch {
      // Non-fatal; the feed fallback below still applies.
    }
    if (prefixStory) {
      dbStory = prefixStory;
      storyToRender = formatStory(prefixStory, colorForTopic(prefixStory.topic));
    } else {
      // 3. Curated seed story
      const seedStory = seedStories.find((s) => slugify(s.title) === storyId);
      if (seedStory) {
        storyToRender = formatStory(seedStory, colorForTopic(seedStory.topic));
      } else {
        // 4. Live feed story that hasn't been ingested yet
        try {
          const live = (await fetchAiNews()).find((s) => s.slug === storyId);
          if (live) {
            storyToRender = formatStory(live, colorForTopic(live.topic));
            // Store it in the background so the next visit reads it from the
            // database instead of re-downloading every feed.
            void persistFeedStory(live);
          }
        } catch {
          // Ignore and fall through to not-found.
        }
      }
    }
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
        if (dbStory?.id) {
          persistEnrichedStory(
            dbStory.id,
            outcome.article.body,
            resolvedDeck,
            resolvedKeyPoints,
            resolvedBrief,
            resolvedWhyItMatters,
            resolvedImageUrl ?? null,
          ).catch(() => {});
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

      <article className={`story-article article-${story.color}`}>
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
