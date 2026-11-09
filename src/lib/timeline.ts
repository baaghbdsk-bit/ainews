import {
  getPublishedStories,
  getPublishedStoriesBySlugs,
  getPublishedStoriesForDate,
  getPublishedStoriesCountForDate,
  getUpvoteCounts,
} from '@/lib/actions/stories';
import { stories as seedStories } from '@/app/stories';
import { canonicalizeUrl, slugify } from '@/lib/slug';
import { colorForTopic } from '@/lib/story-colors';
import { extractCompany } from '@/lib/story-company';
import { deduplicateStories } from '@/lib/story-dedup';
import { selectDigestHighlights } from '@/lib/digest-priority';
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
    summary: story.summary || story.deck || '',
    significance: story.significance,
    source: story.source,
    sourceUrl: story.source_url,
    company:
      story.company ??
      extractCompany({
        title: story.title,
        summary: story.summary || story.deck || '',
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

const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory worker cache to eliminate Supabase egress & avoid subrequest limits
let cachedTimeline: CacheEntry<TimelineStoryDisplay[]> | null = null;
const TIMELINE_CACHE_TTL_MS = 300_000; // 5 minutes TTL
let inFlightTimelinePromise: Promise<TimelineStoryDisplay[]> | null = null;

export interface DateStoriesResult {
  stories: TimelineStoryDisplay[];
  total: number;
  mode: 'highlights' | 'all';
}

const dateStoriesCache = new Map<string, CacheEntry<TimelineStoryDisplay[]>>();
const dateHighlightsCache = new Map<string, CacheEntry<DateStoriesResult>>();
const DATE_CACHE_TTL_MS = 120_000; // 2 minutes TTL for historical dates

export function invalidateTimelineCache(): void {
  cachedTimeline = null;
  dateStoriesCache.clear();
  dateHighlightsCache.clear();
}

async function fetchMergedTimelineInternal(): Promise<TimelineStoryDisplay[]> {
  // Concurrently fetch published stories and upvotes ONCE without duplicated queries
  const [dbStories, upvoteCounts] = IS_BUILD_TIME
    ? [[], {}]
    : await Promise.all([
        getPublishedStories(),
        getUpvoteCounts(),
      ]);

  const seedSubset = (dbStories && dbStories.length > 0) ? seedStories.slice(0, 25) : seedStories;
  const seedConverted = seedSubset.map(convertSeedStory);
  const sources = [...(dbStories ?? []), ...seedConverted];

  const imageByUrl = new Map<string, string>();
  const imageByTitleDate = new Map<string, string>();
  for (const story of sources) {
    if (!story.image_url) continue;
    const urlKey = canonicalizeUrl(story.source_url);
    if (!imageByUrl.has(urlKey)) imageByUrl.set(urlKey, story.image_url);
    const titleDate = `${story.title.trim().toLowerCase()}|${story.event_date}`;
    if (!imageByTitleDate.has(titleDate)) imageByTitleDate.set(titleDate, story.image_url);
  }

  const storedByUrl = new Map<string, Story>();
  for (const story of dbStories ?? []) {
    const urlKey = canonicalizeUrl(story.source_url);
    if (!storedByUrl.has(urlKey)) storedByUrl.set(urlKey, story);
  }

  const merged: Story[] = [];
  const seenUrls = new Set<string>();
  const seenTitleDate = new Set<string>();
  const aliasSlugs = new Map<string, string[]>();

  const pushStory = (story: Story) => {
    const urlKey = canonicalizeUrl(story.source_url);
    if (seenUrls.has(urlKey)) return;
    seenUrls.add(urlKey);

    const titleDate = `${story.title.trim().toLowerCase()}|${story.event_date}`;
    if (seenTitleDate.has(titleDate)) return;
    seenTitleDate.add(titleDate);

    if (!story.image_url) {
      story.image_url = imageByUrl.get(urlKey) ?? imageByTitleDate.get(titleDate);
    }

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

  const formatted = merged.map((s) => {
    let upvotes = (upvoteCounts as Record<string, number>)[s.slug] ?? 0;
    if (!upvotes) {
      for (const alias of aliasSlugs.get(s.slug) ?? []) {
        const aliased = (upvoteCounts as Record<string, number>)[alias];
        if (aliased) {
          upvotes = aliased;
          break;
        }
      }
    }
    return formatStoryForDisplay(s, colorForTopic(s.topic), upvotes);
  });

  return deduplicateStories(formatted);
}

/**
 * The full merged timeline (published DB rows + seed history),
 * cached in memory with a sliding TTL to eliminate repetitive Supabase egress.
 */
export async function getMergedTimeline(): Promise<TimelineStoryDisplay[]> {
  if (IS_BUILD_TIME) {
    return fetchMergedTimelineInternal();
  }

  const now = Date.now();
  if (cachedTimeline) {
    // If cache is fresh, return immediately (0ms)
    if (now - cachedTimeline.timestamp < TIMELINE_CACHE_TTL_MS) {
      return cachedTimeline.data;
    }
    // Stale-While-Revalidate: Return cached data immediately without blocking the user,
    // while refreshing cache in background
    if (!inFlightTimelinePromise) {
      inFlightTimelinePromise = fetchMergedTimelineInternal()
        .then((data) => {
          cachedTimeline = { data, timestamp: Date.now() };
          return data;
        })
        .finally(() => {
          inFlightTimelinePromise = null;
        });
    }
    return cachedTimeline.data;
  }

  if (inFlightTimelinePromise) {
    return inFlightTimelinePromise;
  }

  inFlightTimelinePromise = fetchMergedTimelineInternal()
    .then((data) => {
      cachedTimeline = { data, timestamp: Date.now() };
      return data;
    })
    .finally(() => {
      inFlightTimelinePromise = null;
    });

  return inFlightTimelinePromise;
}

export async function getTimelineStoriesBySlugs(slugs: string[]): Promise<TimelineStoryDisplay[]> {
  const requestedSlugs = [...new Set(slugs)].slice(0, 500);
  if (requestedSlugs.length === 0) return [];

  const [publishedStories, upvoteCounts] = await Promise.all([
    getPublishedStoriesBySlugs(requestedSlugs),
    getUpvoteCounts(requestedSlugs),
  ]);
  const storiesBySlug = new Map(publishedStories.map((story) => [story.slug, story]));

  for (const seedStory of seedStories) {
    const story = convertSeedStory(seedStory);
    if (requestedSlugs.includes(story.slug) && !storiesBySlug.has(story.slug)) {
      storiesBySlug.set(story.slug, story);
    }
  }

  return requestedSlugs
    .map((slug) => storiesBySlug.get(slug))
    .filter((story): story is Story => story !== undefined)
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
    .map((story) =>
      formatStoryForDisplay(story, colorForTopic(story.topic), upvoteCounts[story.slug] ?? 0),
    );
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

/**
 * Lazy-load stories specifically for a given date (YYYY-MM-DD).
 * Supports on-demand 'highlights' mode (fast count + top 5 milestones)
 * and 'all' mode (full chronological stream).
 */
export async function getStoriesForDate(
  dateStr: string,
  mode: 'highlights' | 'all' = 'highlights',
): Promise<DateStoriesResult> {
  const now = Date.now();

  // 1. If full stories are already cached for this date, fulfill either mode instantly with 0 queries
  const fullCached = dateStoriesCache.get(dateStr);
  if (fullCached && now - fullCached.timestamp < DATE_CACHE_TTL_MS) {
    if (mode === 'all') {
      return { stories: fullCached.data, total: fullCached.data.length, mode: 'all' };
    }
    const deduped = deduplicateStories(fullCached.data);
    const ranked = selectDigestHighlights(deduped, 5);
    const top5 = ranked.length > 0 ? ranked : deduped.slice(0, 5);
    return { stories: top5, total: fullCached.data.length, mode: 'highlights' };
  }

  // 2. Highlights-Only Fast Path (High Performance & Low Egress):
  if (mode === 'highlights') {
    const hlCached = dateHighlightsCache.get(dateStr);
    if (hlCached && now - hlCached.timestamp < DATE_CACHE_TTL_MS) {
      return hlCached.data;
    }

    // Fast count query (0 row payloads) + fetch only 12 rows (instead of 300+)
    const [dbCount, dbRows, upvoteCounts] = await Promise.all([
      getPublishedStoriesCountForDate(dateStr),
      getPublishedStoriesForDate(dateStr, 12),
      getUpvoteCounts().catch((): Record<string, number> => ({})),
    ]);

    const matchingSeeds = seedStories
      .filter((s) => s.date === dateStr)
      .map(convertSeedStory);

    const combined = [...dbRows, ...matchingSeeds];
    const seen = new Set<string>();
    const unique: TimelineStoryDisplay[] = [];

    for (const s of combined) {
      const key = canonicalizeUrl(s.source_url) || s.slug || s.title;
      if (seen.has(key)) continue;
      seen.add(key);
      const votes = upvoteCounts[s.slug] ?? 0;
      unique.push(formatStoryForDisplay(s, colorForTopic(s.topic), votes));
    }

    if (unique.length < 5) {
      // Do not fabricate stories for dates without real coverage.
    }

    let totalCount = dbCount + matchingSeeds.length;
    if (unique.length > totalCount) totalCount = unique.length;

    const deduped = deduplicateStories(unique);
    const ranked = selectDigestHighlights(deduped, 5);
    const top5 = ranked.length > 0 ? ranked : deduped.slice(0, 5);

    const result: DateStoriesResult = {
      stories: top5,
      total: totalCount,
      mode: 'highlights',
    };

    dateHighlightsCache.set(dateStr, { data: result, timestamp: now });
    return result;
  }

  // 3. All Feed Mode (Full Chronological Ingestion):
  const [dbRows, upvoteCounts] = await Promise.all([
    getPublishedStoriesForDate(dateStr, 300),
    getUpvoteCounts().catch((): Record<string, number> => ({})),
  ]);

  const matchingSeeds = seedStories
    .filter((s) => s.date === dateStr)
    .map(convertSeedStory);

  const combined = [...dbRows, ...matchingSeeds];
  const seen = new Set<string>();
  const unique: TimelineStoryDisplay[] = [];

  for (const s of combined) {
    const key = canonicalizeUrl(s.source_url) || s.slug || s.title;
    if (seen.has(key)) continue;
    seen.add(key);
    const votes = upvoteCounts[s.slug] ?? 0;
    unique.push(formatStoryForDisplay(s, colorForTopic(s.topic), votes));
  }

    if (unique.length < 5) {
      // Do not fabricate stories for dates without real coverage.
    }

  const dedupedUnique = deduplicateStories(unique);
  dateStoriesCache.set(dateStr, { data: dedupedUnique, timestamp: now });

  // Pre-warm highlights cache from this complete set
  const ranked = selectDigestHighlights(dedupedUnique, 5);
  const top5 = ranked.length > 0 ? ranked : dedupedUnique.slice(0, 5);
  dateHighlightsCache.set(dateStr, {
    data: { stories: top5, total: dedupedUnique.length, mode: 'highlights' },
    timestamp: now,
  });

  return { stories: dedupedUnique, total: dedupedUnique.length, mode: 'all' };
}
