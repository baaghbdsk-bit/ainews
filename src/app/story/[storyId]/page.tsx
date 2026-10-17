import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { getStoryBySlug } from "@/lib/actions/stories";
import { fetchAiNews } from "@/lib/feeds/fetch-ai-news";
import type { Story } from "@/lib/schemas/story";
import { matchEntities } from "@/lib/dossier/entities";
import { stories as seedStories } from "../../stories";
import type { Story as SeedStory } from "../../stories";
import { slugify } from "@/lib/slug";
import { colorForTopic } from "@/lib/story-colors";
import { SiteHeader } from "../../site-header";

export const instant = false;

// Block unlisted slugs on their static result instead of streaming the App
// Shell: an unknown story returns a real 404 on the first request rather than
// a 200 that upgrades after a background render.
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

  // Mirror the page's lookup chain (db → seed → live). Calling notFound() here
  // — before the response streams — is what makes a missing story return a real
  // HTTP 404 instead of a streamed 200 with a "not found" title.
  let dbStory: Story | null = null;
  try {
    dbStory = await getStoryBySlug(storyId);
  } catch {
    // During prerendering, Supabase may not be available; fall through.
  }
  if (dbStory) {
    return {
      title: `${dbStory.title} | Signal`,
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
      title: `${seedStory.title} | Signal`,
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
        title: `${live.title} | Signal`,
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
  date: string;
  day: string;
  month: string;
  year: string;
  color: string;
  sourceUrl: string;
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

  return {
    ...story,
    date: dateStr,
    day: day?.replace(/^0/, "") ?? "",
    month: monthNames[(parseInt(month ?? "", 10) || 1) - 1] ?? "",
    year: year ?? "",
    color,
    sourceUrl: hasSourceUrl ? story.source_url : 'sourceUrl' in story ? story.sourceUrl : "",
  };
}


export default async function StoryPage({ params }: StoryPageProps) {
  const { storyId } = await params;

  let dbStory: Story | null = null;
  try {
    dbStory = await getStoryBySlug(storyId);
  } catch {
    // During prerendering, Supabase may not be available — fall back below.
  }

  // 1. Persisted / ingested story (has the extracted article body).
  if (dbStory) {
    const story = formatStory(dbStory, colorForTopic(dbStory.topic));
    if (!story) notFound();
    return renderStoryPage(story);
  }

  // 2. Curated seed story.
  const seedStory = seedStories.find((s) => slugify(s.title) === storyId);
  if (seedStory) {
    const story = formatStory(seedStory, colorForTopic(seedStory.topic));
    if (!story) notFound();
    return renderStoryPage(story);
  }

  // 3. Live feed story that hasn't been ingested yet — render it from the feed
  //    so a fresh headline never leads to a 404.
  try {
    const live = (await fetchAiNews()).find((s) => s.slug === storyId);
    if (live) {
      const story = formatStory(live, colorForTopic(live.topic));
      if (story) return renderStoryPage(story);
    }
  } catch {
    // Ignore and fall through to not-found.
  }

  notFound();
}

function renderStoryPage(story: DisplayStory) {
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

  return (
    <main className="site-frame archive-page story-article-page">
      <SiteHeader
        className="story-article-topbar"
        right={
          <Link className="topbar-link" href="/">
            <ArrowLeft size={15} /> Back to timeline
          </Link>
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
        </div>

        <h1>{story.title}</h1>

        {deck ? <p className="story-article-standfirst">{deck}</p> : null}

        {proseParagraphs.length ? (
          <div className="story-article-body">
            {proseParagraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <p className="story-article-summary">{story.summary}</p>
        )}

        {keyPoints.length ? (
          <aside className="story-article-keypoints" aria-label="Key points">
            <h2>Key points</h2>
            <ul>
              {keyPoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </aside>
        ) : null}

        <div className="story-article-divider">
          <span />
        </div>

        <section className="story-article-context">
          <h2>Why it matters</h2>
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

        <footer className="story-article-source">
          <BookOpen size={16} />
          <span>
            Source: <strong>{story.source}</strong>
          </span>
          <a href={story.sourceUrl} rel="noreferrer" target="_blank">
            Read original source <ArrowUpRight size={14} />
          </a>
        </footer>
      </article>
    </main>
  );
}
