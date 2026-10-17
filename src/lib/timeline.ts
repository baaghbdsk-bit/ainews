import { cacheLife, cacheTag } from 'next/cache';
import { fetchAiNews, AI_NEWS_TAG } from '@/lib/feeds/fetch-ai-news';
import { getPublishedStories } from '@/lib/actions/stories';
import { STORIES_TAG } from '@/lib/cache-tags';
import { stories as seedStories } from '@/app/stories';
import { canonicalizeUrl, slugify } from '@/lib/slug';
import { colorForTopic } from '@/lib/story-colors';
import { extractCompany } from '@/lib/story-company';
import type { Story } from '@/lib/schemas/story';
import type { StoryDisplay, TimelineFilters } from '@/lib/timeline-shared';
import { PAGE_SIZE, filterTimelineStories } from '@/lib/timeline-shared';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Convert seed stories to the DB-compatible Story shape. Derived from the
 *  story's own date so the page stays prerenderable — `new Date()` is unstable
 *  during prerender and blocks the static shell. */
function convertSeedStory(story: (typeof seedStories)[number]): Story {
  const stableTimestamp = `${story.date}T00:00:00.000Z`;
  return {
    id: story.id,
    slug: slugify(story.title),
    title: story.title,
    summary: story.summary,
    significance: story.significance,
    source: story.source,
    source_url: story.sourceUrl,
    company: story.company ?? undefined,
    topic: story.topic,
    event_date: story.date,
    published_at: stableTimestamp,
    status: 'published' as const,
    created_by: 'seed',
    updated_by: 'seed',
    created_at: stableTimestamp,
    updated_at: stableTimestamp,
  };
}

/** Project a Story down to only the fields the timeline renders, so full
 *  database rows (body, deck, key points, audit columns) never leave the
 *  server. One projection, shared by the SSR first page and the API. */
function formatStoryForDisplay(story: Story, color: string): StoryDisplay {
  const [year, month, day] = story.event_date.split('-');

  return {
    id: story.id || story.slug,
    slug: story.slug,
    title: story.title,
    summary: story.summary,
    significance: story.significance,
    source: story.source,
    sourceUrl: story.source_url,
    company:
      story.company ??
      extractCompany({
        title: story.title,
        summary: story.summary,
        source: story.source,
      }),
    topic: story.topic,
    date: story.event_date,
    day: day.replace(/^0/, ''),
    month: MONTH_NAMES[parseInt(month, 10) - 1],
    year,
    color,
  };
}

/**
 * The full merged timeline (live RSS + published DB rows + seed history),
 * de-duplicated by URL and (title, date), newest first, projected to the slim
 * display shape. Cached under both feed and story tags: a feed refresh or an
 * editorial publish invalidates it.
 */
export async function getMergedTimeline(): Promise<StoryDisplay[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(AI_NEWS_TAG, STORIES_TAG);

  const [liveStories, dbStories] = await Promise.all([fetchAiNews(), getPublishedStories()]);
  const seedConverted = seedStories.map(convertSeedStory);

  const merged: Story[] = [];
  const seenUrls = new Set<string>();
  const seenTitleDate = new Set<string>();
  const pushStory = (story: Story) => {
    const urlKey = canonicalizeUrl(story.source_url);
    const titleDate = `${story.title.trim().toLowerCase()}|${story.event_date}`;
    if (seenUrls.has(urlKey) || seenTitleDate.has(titleDate)) return;
    seenUrls.add(urlKey);
    seenTitleDate.add(titleDate);
    merged.push(story);
  };
  [...liveStories, ...(dbStories ?? []), ...seedConverted].forEach(pushStory);
  merged.sort((a, b) => b.event_date.localeCompare(a.event_date));

  return merged.map((s) => formatStoryForDisplay(s, colorForTopic(s.topic)));
}

export interface TimelinePage {
  stories: StoryDisplay[];
  /** Total stories across the full merged set (unfiltered). */
  total: number;
  /** Total stories matching the filters (what the count line shows). */
  matching: number;
  hasMore: boolean;
}

/** One filtered, paginated window of the timeline. */
export async function getTimelinePage(filters: TimelineFilters, offset = 0, limit = PAGE_SIZE): Promise<TimelinePage> {
  const all = await getMergedTimeline();
  const filtered = filterTimelineStories(all, filters);
  return {
    stories: filtered.slice(offset, offset + limit),
    total: all.length,
    matching: filtered.length,
    hasMore: offset + limit < filtered.length,
  };
}
