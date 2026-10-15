import { cacheLife, cacheTag } from 'next/cache';
import { XMLParser } from 'fast-xml-parser';
import type { Story } from '@/lib/schemas/story';

export type { Story };
export type Topic = Story['topic'];
type FeedSource = { name: string; url: string; topic: Topic };

export const FEEDS: FeedSource[] = [
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', topic: 'Models' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', topic: 'Research' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', topic: 'Models' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', topic: 'Research' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', topic: 'Products' },
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', topic: 'Products' },
];

const FETCH_TIMEOUT_MS = 3000;
// Large feeds (OpenAI, Hugging Face) carry thousands of historical entries;
// capping high keeps 4+ years of timeline depth while staying bounded.
const MAX_ITEMS_PER_FEED = 400;
// Timeline depth: ignore anything older than this many years.
const HISTORY_YEARS = 4;
// Global cap after cross-feed dedup. Six feeds x MAX_ITEMS_PER_FEED serialized
// roughly 700 KB into the timeline HTML; this keeps the shell small enough for
// the navigation to feel immediate while the seed + editorial stories keep the
// historical anchors intact.
const MAX_LIVE_STORIES = 150;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
// Tag used to invalidate the merged timeline after an editorial publish.
export const AI_NEWS_TAG = 'ai-news';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

type RawItem = Record<string, unknown>;

function textOf(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && '#text' in value) {
    return textOf((value as Record<string, unknown>)['#text']);
  }
  return '';
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return input.slice(0, max - 1).trimEnd() + '…';
}

/** Trim the "The post … appeared first on …" / "Continue reading" boilerplate
 *  that wraps many WordPress feed descriptions, so previews read cleanly. */
function stripFeedBoilerplate(input: string): string {
  let text = input;
  text = text.replace(/\s*The post .*? appeared first on .*?\.?\s*$/i, '');
  text = text.replace(/\s*\.{0,3}\s*(\(|)?(Continue reading|Read more)(…|\)|])?[^\s]*\.?\s*$/i, '');
  return text.trim();
}

/** Pick the longest of the candidate text fields (feeds scatter the real body
 *  across description / content:encoded / content), so a feed that only fills
 *  `content` still yields a substantive preview instead of the bare title. */
function bestSummaryText(item: RawItem): string {
  const candidates = [
    textOf(item['content:encoded']),
    textOf(item.content),
    textOf(item.description),
    textOf(item.summary),
  ];
  let best = '';
  for (const raw of candidates) {
    const cleaned = stripFeedBoilerplate(stripHtml(raw));
    if (cleaned.length > best.length) best = cleaned;
  }
  return best;
}

function toHttpsUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function toIsoDate(raw: string): string | null {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function atomLink(entry: RawItem): string {
  const links = ([] as unknown[]).concat(entry.link ?? []);
  const objects = links.filter((l): l is Record<string, unknown> => typeof l === 'object' && l !== null);
  const alt = objects.find((l) => l['@_rel'] === 'alternate') ?? objects[0];
  return alt ? textOf(alt['@_href']) : textOf(entry.link);
}

export function extractItems(parsed: Record<string, unknown>): RawItem[] {
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel?.item) return ([] as unknown[]).concat(channel.item) as RawItem[];

  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (feed?.entry) return ([] as unknown[]).concat(feed.entry) as RawItem[];

  return [];
}

export function normalizeItem(item: RawItem, feed: FeedSource): Story | null {
  const title = stripHtml(textOf(item.title));
  const link = toHttpsUrl(textOf(item.link) || atomLink(item));
  const dateRaw =
    textOf(item.pubDate) || textOf(item.published) || textOf(item.updated) || textOf(item['dc:date']);
  const eventDate = toIsoDate(dateRaw);
  const summary = bestSummaryText(item);

  if (!title || !link || !eventDate) return null;

  const slugBase = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  const slug = `${slugBase}-${eventDate}`;
  const now = new Date().toISOString();

  return {
    id: slug,
    slug,
    title: truncate(title, 255),
    summary: truncate(summary || title, 1000),
    significance: buildSignificance(title, summary, feed, eventDate),
    source: feed.name,
    source_url: link,
    topic: feed.topic,
    event_date: eventDate,
    published_at: now,
    status: 'published',
    created_at: now,
    updated_at: now,
  };
}

function firstMeaningfulSentence(summary: string, title: string): string {
  if (!summary) return '';
  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const titleNorm = normalize(title);
  for (const sentence of sentences) {
    const norm = normalize(sentence);
    if (norm.length < 40) continue;
    if (titleNorm && (norm === titleNorm || norm.startsWith(titleNorm))) continue;
    return truncate(sentence, 220).replace(/[.…]+$/, '');
  }
  const longest = sentences.slice().sort((a, b) => b.length - a.length)[0];
  return longest ? truncate(longest, 220).replace(/[.…]+$/, '') : '';
}

/** Compose a non-generic "why it matters" from the feed's own content. Lead with
 *  the strongest sentence from the summary, then attribute source + date. Falls
 *  back gracefully when the summary is thin. Kept short — a single, useful line. */
function buildSignificance(title: string, summary: string, feed: FeedSource, eventDate: string): string {
  const lead = firstMeaningfulSentence(summary, title);
  const when = new Date(eventDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  if (lead) return `${lead} Reported by ${feed.name} on ${when}.`;
  return `${title}. Covered by ${feed.name} on ${when}.`;
}

async function fetchFeedXml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
    });
    if (!res.ok) return null;

    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_RESPONSE_BYTES) return null;

    const body = await res.text();
    return body.length > MAX_RESPONSE_BYTES ? null : body;
  } catch (err) {
    console.error(`Failed to fetch feed ${url}:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadFeed(feed: FeedSource): Promise<Story[]> {
  const xml = await fetchFeedXml(feed.url);
  if (!xml) return [];

  try {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const cutoffYear = new Date().getFullYear() - HISTORY_YEARS;
    return (
      extractItems(parsed)
        .map((item) => normalizeItem(item, feed))
        .filter((s): s is Story => s !== null && Number(s.event_date.slice(0, 4)) >= cutoffYear)
        .slice(0, MAX_ITEMS_PER_FEED)
    );
  } catch (err) {
    console.error(`Failed to parse feed ${feed.url}:`, err);
    return [];
  }
}

/**
 * Fetch recent AI news from public RSS/Atom feeds, newest first.
 * Failing feeds are skipped; returns an empty array if all fail.
 *
 * Cached so navigation to the timeline never waits on six upstream feeds.
 */
export async function fetchAiNews(): Promise<Story[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(AI_NEWS_TAG);

  const results: Story[][] = await Promise.all(FEEDS.map(loadFeed));
  const seen = new Set<string>();
  const merged: Story[] = [];
  for (const batch of results) {
    for (const story of batch) {
      if (story.source_url && !seen.has(story.source_url)) {
        seen.add(story.source_url);
        merged.push(story);
      }
    }
  }

  merged.sort((a, b) => b.event_date.localeCompare(a.event_date));
  return merged.slice(0, MAX_LIVE_STORIES);
}

