import { cacheLife, cacheTag } from 'next/cache';
import { fetchAiNews, AI_NEWS_TAG } from '@/lib/feeds/fetch-ai-news';
import { getPublishedStoriesWithVotes, getUpvoteCounts } from '@/lib/actions/stories';
import { STORIES_TAG } from '@/lib/cache-tags';
import { stories as seedStories } from '@/app/stories';
import { canonicalizeUrl, slugify } from '@/lib/slug';
import { colorForTopic } from '@/lib/story-colors';
import { extractCompany } from '@/lib/story-company';
import type { Story } from '@/lib/schemas/story';
import type { StoryDisplay, TimelineFilters } from '@/lib/timeline-shared';
import { PAGE_SIZE, filterTimelineStories } from '@/lib/timeline-shared';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A timeline row carries the vote total the server read for its slug. */
export interface TimelineStoryDisplay extends StoryDisplay {
  upvoteCount?: number;
}

type TimelineStory = Story & { upvote_count?: number };

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
function formatStoryForDisplay(
  story: TimelineStory,
  color: string,
  upvoteCount: number,
): TimelineStoryDisplay {
  const [year, month, day] = story.event_date.split('-');

  return {
    id: story.id || story.slug,
    slug: story.slug,
    title: story.title,
    summary: story.deck ?? story.summary,
    significance: story.significance,
    source: story.source,
    sourceUrl: story.source_url,
    company:
      story.company ??
      extractCompany({
        title: story.title,
        summary: story.deck ?? story.summary,
        source: story.source,
      }),
    imageUrl: story.image_url ?? null,
    deck: story.deck ?? null,
    keyPoints: story.key_points ?? null,
    whyItMatters: story.why_it_matters ?? null,
    topic: story.topic,
    date: story.event_date,
    day: day.replace(/^0/, ''),
    month: MONTH_NAMES[parseInt(month, 10) - 1],
    year,
    color,
    upvoteCount,
  };
}

/**
 * The full merged timeline (live RSS + published DB rows + seed history),
 * de-duplicated by URL and (title, date), newest first, projected to the slim
 * display shape. Cached under both feed and story tags: a feed refresh or an
 * editorial publish invalidates it.
 */
/** True during `next build` prerender; skips slow external feeds/DB so builds
 *  are fast and deterministic. Live data is fetched on first runtime visit. */
const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build';

export async function getMergedTimeline(): Promise<TimelineStoryDisplay[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(AI_NEWS_TAG, STORIES_TAG);

  // During production build, skip slow external sources so prerender completes
  // quickly. Seed stories provide a static snapshot; live data fills in on the
  // first runtime visit once the cache warms. Each source already enforces its
  // own timeout internally (fetchAiNews: 3s per feed; Supabase: its own timeouts),
  // so no wrapper deadline is needed here.
  const liveStories = IS_BUILD_TIME ? [] : await fetchAiNews();
  const dbStories = IS_BUILD_TIME ? [] : await getPublishedStoriesWithVotes();
  const upvoteCounts = IS_BUILD_TIME ? {} : await getUpvoteCounts();
  const seedConverted = seedStories.map(convertSeedStory);

  const sources = [...liveStories, ...(dbStories ?? []), ...seedConverted];

  // A live feed copy wins for the text (it is the publisher's current version)
  // but usually carries no image, while the stored row for the same story has a
  // lead image resolved by the ingest job. Index every image up front, by URL
  // and by (title, date), so whichever copy survives de-duplication can borrow
  // the image instead of falling back to a monogram tile.
  const imageByUrl = new Map<string, string>();
  const imageByTitleDate = new Map<string, string>();
  for (const story of sources) {
    if (!story.image_url) continue;
    const urlKey = canonicalizeUrl(story.source_url);
    if (!imageByUrl.has(urlKey)) imageByUrl.set(urlKey, story.image_url);
    const titleDate = `${story.title.trim().toLowerCase()}|${story.event_date}`;
    if (!imageByTitleDate.has(titleDate)) imageByTitleDate.set(titleDate, story.image_url);
  }

  // The stored row for a story carries the enriched content the ingest job
  // produced: the extracted body, the key points, the deck, the lead image.
  // It also carries the slug the story is published under, which is stable -
  // a feed copy mints a fresh slug whenever the publisher moves a post's date,
  // so the feed slug and the stored slug drift apart. Serving the feed's slug
  // meant the article page could not find the stored row, and fell through to
  // re-downloading every feed on each visit. Index the stored rows by URL so
  // the surviving copy can adopt their slug and their enrichment.
  const storedByUrl = new Map<string, Story>();
  for (const story of dbStories ?? []) {
    const urlKey = canonicalizeUrl(story.source_url);
    if (!storedByUrl.has(urlKey)) storedByUrl.set(urlKey, story);
  }

  const merged: Story[] = [];
  const seenUrls = new Set<string>();
  const seenTitleDate = new Set<string>();
  // Votes are recorded against the slug the reader saw, so a story that adopts
  // the stored row's slug must keep counting the votes under the slug it had.
  const aliasSlugs = new Map<string, string[]>();
  const pushStory = (story: Story) => {
    const urlKey = canonicalizeUrl(story.source_url);
    // Primary dedup: canonical URL is the ground truth. Stories covered by
    // multiple outlets have different titles across feeds, so a title-based
    // check lets both copies through. URL wins when present.
    if (seenUrls.has(urlKey)) return;
    seenUrls.add(urlKey);
    // Secondary dedup: same title + same day catches cross-feed duplicates of
    // the same news that carry different source URLs (RSS feeds each link to
    // their own copy of the story). Applies to every story, not only those
    // without a URL, so syndicated stories don't appear 2–3 times.
    const titleDate = `${story.title.trim().toLowerCase()}|${story.event_date}`;
    if (seenTitleDate.has(titleDate)) return;
    seenTitleDate.add(titleDate);
    if (!story.image_url) {
      story.image_url = imageByUrl.get(urlKey) ?? imageByTitleDate.get(titleDate);
    }

    // Adopt the stored row's slug and enrichment when this copy came from the
    // feed. The text still comes from the feed, so a corrected publisher
    // summary still wins.
    const stored = storedByUrl.get(urlKey);
    if (stored && stored.slug !== story.slug) {
      const previousSlug = story.slug;
      story.slug = stored.slug;
      aliasSlugs.set(stored.slug, [...(aliasSlugs.get(stored.slug) ?? []), previousSlug]);
      if (!story.body && stored.body) story.body = stored.body;
      if (!story.deck && stored.deck) story.deck = stored.deck;
      if (!story.brief && stored.brief) story.brief = stored.brief;
      if (!story.key_points?.length && stored.key_points?.length) {
        story.key_points = stored.key_points;
      }
      if (!story.why_it_matters && stored.why_it_matters) {
        story.why_it_matters = stored.why_it_matters;
      }
      if (!story.image_url && stored.image_url) story.image_url = stored.image_url;
    }

    merged.push(story);
  };
  sources.forEach(pushStory);
  merged.sort((a, b) => b.event_date.localeCompare(a.event_date));

  return merged.map((s) => {
    // Count votes under the story's current slug, falling back to any slug it
    // was previously published under so a rename never drops a reader's vote.
    let upvotes = upvoteCounts[s.slug] ?? 0;
    if (!upvotes) {
      for (const alias of aliasSlugs.get(s.slug) ?? []) {
        const aliased = upvoteCounts[alias];
        if (aliased) {
          upvotes = aliased;
          break;
        }
      }
    }
    return formatStoryForDisplay(s, colorForTopic(s.topic), upvotes);
  });
}

export interface TimelinePage {
  stories: TimelineStoryDisplay[];
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
