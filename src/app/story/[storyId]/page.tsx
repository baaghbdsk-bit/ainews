import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Orbit } from "lucide-react";
import { notFound } from "next/navigation";
import { getStoryBySlug } from "@/lib/actions/stories";
import type { Story } from "@/lib/schemas/story";
import { stories as seedStories } from "../../stories";
import type { Story as SeedStory } from "../../stories";

export const instant = false;

type StoryPageProps = {
  params: Promise<{ storyId: string }>;
};

/**
 * Generate static params for seed data (for initial deployment)
 */
export function generateStaticParams() {
  return seedStories.map(({ title }) => ({
    storyId: title.toLowerCase().replace(/\s+/g, "-"),
  }));
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { storyId } = await params;

  try {
    const story = await getStoryBySlug(storyId);
    if (story) {
      return {
        title: `${story.title} | Signal`,
        description: story.summary,
      };
    }
  } catch {
    // During prerendering, Supabase may not be available
    // Fall back to seed data
  }

  // Fallback to seed data if Supabase unavailable
  const seedStory = seedStories.find(
    (s) => s.title.toLowerCase().replace(/\s+/g, "-") === storyId
  );

  return {
    title: seedStory ? `${seedStory.title} | Signal` : "Story not found | Signal",
    description: seedStory?.summary,
  };
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
    // During prerendering, Supabase may not be available
    // Fall back to seed data
  }

  // If no DB story, try seed data
  if (!dbStory) {
    const seedStory = seedStories.find(
      (s) => s.title.toLowerCase().replace(/\s+/g, "-") === storyId
    );

    if (!seedStory) notFound();

    const colors = ["blue", "purple", "cyan", "amber", "rose"];
    const story = formatStory(seedStory, colors[0]);

    if (!story) notFound();

    return renderStoryPage(story);
  }

  const colors = ["blue", "purple", "cyan", "amber", "rose"];
  const story = formatStory(dbStory, colors[0]);

  if (!story) notFound();

  return renderStoryPage(story);
}

function renderStoryPage(story: DisplayStory) {
  return (
    <main className="site-frame archive-page story-article-page">
      <header className="topbar archive-topbar story-article-topbar">
        <Link className="wordmark" href="/" aria-label="Signal, home">
          <span className="wordmark-symbol">
            <Orbit size={19} strokeWidth={2.1} />
          </span>
          <span>
            signal<span className="wordmark-period">.</span>
          </span>
        </Link>
        <Link className="topbar-link" href="/">
          <ArrowLeft size={15} /> Back to timeline
        </Link>
      </header>

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
        <p className="story-article-summary">{story.summary}</p>

        <div className="story-article-divider">
          <span />
        </div>

        <section className="story-article-context">
          <h2>Why it matters</h2>
          <p>{story.significance}</p>
        </section>

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
