/**
 * Isolated Google News RSS discovery module.
 *
 * Discovery only: no DB writes, no publishing, no production mutation.
 */

import { canonicalizeUrl } from '../slug.ts';
import { extractCompany } from '../story-company.ts';
import { classifyStoryTopic } from '../feeds/classify-topic.ts';

export type Topic = 'Models' | 'Products' | 'Research' | 'Policy';

export interface DiscoveryQuery {
  id: string;
  label: string;
  query: string;
}

export const DISCOVERY_QUERIES: DiscoveryQuery[] = [
  { id: 'anthropic-claude', label: 'Anthropic / Claude', query: 'Anthropic OR Claude AI' },
  { id: 'moonshot-kimi', label: 'Moonshot / Kimi', query: 'Moonshot AI OR Kimi AI' },
  { id: 'openai', label: 'OpenAI', query: 'OpenAI' },
  { id: 'google-deepmind', label: 'Google DeepMind', query: '"Google DeepMind" OR Gemini AI' },
  { id: 'meta-ai', label: 'Meta AI', query: 'Meta AI OR Llama' },
  { id: 'deepseek', label: 'DeepSeek', query: 'DeepSeek' },
  { id: 'mistral', label: 'Mistral', query: 'Mistral AI' },
  { id: 'cohere', label: 'Cohere', query: 'Cohere AI' },
  { id: 'hugging-face', label: 'Hugging Face', query: '"Hugging Face"' },
  { id: 'ai-research', label: 'AI research', query: 'AI research model benchmark' },
  { id: 'ai-funding', label: 'AI funding', query: 'AI startup funding raises' },
  { id: 'ai-policy', label: 'AI policy', query: 'AI policy regulation safety' },
];

export interface UtcWindow {
  start: string;
  end: string;
}

export interface PublisherValidation {
  attempted: boolean;
  httpStatus: number | null;
  finalUrl: string | null;
  canonicalUrl: string | null;
  pageTitle: string | null;
  pagePublishedAt: string | null;
  titleMatch: boolean;
  valid: boolean;
  error: string | null;
  decoderAttempted: boolean;
  decoderSucceeded: boolean;
  decoderError: string | null;
  pageQuality: 'news' | 'possible-news' | 'tutorial' | 'seo' | 'low-credibility' | 'unknown';
  dateConflict: boolean;
}

export type DiscoveryCandidateStatus = 'accepted' | 'rejected' | 'held';

export interface DiscoveryCandidate {
  id: string;
  queryId: string;
  queryLabel: string;
  query: string;
  googleNewsUrl: string;
  title: string;
  source: string | null;
  publishedAtUtc: string | null;
  eventDate: string | null;
  company: string | null;
  topic: Topic;
  combinedDigest: boolean;
  relevance: 'relevant' | 'low';
  publisherUrl: string | null;
  canonicalUrl: string | null;
  publisherUrlSource: 'redirect' | 'decoded' | 'google-news-held' | 'not-attempted' | null;
  publisherValidation: PublisherValidation;
  rejectionReasons: string[];
  status: DiscoveryCandidateStatus;
  reviewDisposition: 'publish' | 'hold-for-human-review' | 'reject';
  eventGroupId: string | null;
  pageQuality: 'news' | 'possible-news' | 'tutorial' | 'seo' | 'low-credibility' | 'unknown';
  dateConflict: boolean;
}

export interface DiscoveryMetrics {
  window: UtcWindow;
  queries: {
    total: number;
    succeeded: number;
    failed: number;
    errors: { queryId: string; error: string }[];
  };
  rawItems: number;
  inWindow: number;
  outOfWindow: number;
  missingMetadata: number;
  missingCompany: number;
  duplicates: number;
  lowRelevance: number;
  combinedDigests: number;
  inaccessiblePublishers: number;
  heldCandidates: number;
  uniqueCandidates: number;
  acceptedCandidates: number;
  publisherValidation: { attempted: number; ok: number; failed: number; held: number };
  perQuery: Record<string, { raw: number; inWindow: number; accepted: number; held: number }>;
  perCompany: Record<string, number>;
  companyExtraction: {
    candidatesWithCompany: number;
    acceptedWithCompany: number;
    candidateCoverage: number;
    acceptedCoverage: number;
  };
  pageQuality: Record<string, number>;
  dateConflicts: number;
  eventGroups: number;
  multiSourceEventGroups: number;
  groupedCandidates: number;
  decoder: { attempted: number; succeeded: number; failed: number; unresolved: number };
  runtimeMs: number;
}

export interface DiscoveryResult {
  candidates: DiscoveryCandidate[];
  metrics: DiscoveryMetrics;
}

export interface DiscoveryRunOptions {
  queries?: DiscoveryQuery[];
  window: UtcWindow;
  fetchImpl?: typeof fetch;
  maxConcurrency?: number;
  queryTimeoutMs?: number;
  publisherTimeoutMs?: number;
  maxPublisherBytes?: number;
  validatePublishers?: boolean;
  retryMaxAttempts?: number;
  baseBackoffMs?: number;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const RELEVANCE_KEYWORDS = [
  /\b(?:launch(?:es|ed)?|release(?:s|d)?|unveil(?:s|ed)?|announce(?:s|d)?|introduce(?:s|d)?)\b/i,
  /\b(?:model|benchmark|weights?|checkpoint|reasoning|multimodal)\b/i,
  /\b(?:funding|raises?|valuation|series [abc]|investment)\b/i,
  /\b(?:policy|regulation|safety|export control|lawsuit|antitrust)\b/i,
  /\b(?:research|paper|arxiv|study|benchmark)\b/i,
  /\b(?:claude|kimi|gemini|llama|gpt|deepseek|mistral|cohere)\b/i,
];

const COMBINED_DIGEST_PATTERNS = [
  /;\s*\S/,
  /\b(?:roundup|digest|weekly|recap|round-up)\b/i,
  /\band\s+(?:more|others)\b/i,
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(re);
  return match ? match[1].trim() : '';
}

function extractAttr(block: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']*)["'][^>]*>`, 'i');
  const match = block.match(re);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}
export function buildGoogleNewsUrl(query: string): string {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');
  return url.toString();
}

export interface RawGoogleNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string | null;
  sourceUrl: string | null;
  guid: string | null;
}

export function parseGoogleNewsRss(xml: string): RawGoogleNewsItem[] {
  const itemBlocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  return itemBlocks.map((block) => {
    const sourceBlock = block.match(/<source\b[^>]*>[\s\S]*?<\/source>/i)?.[0] ?? '';
    return {
      title: stripTags(extractTag(block, 'title')),
      link: decodeHtmlEntities(extractTag(block, 'link')),
      pubDate: stripTags(extractTag(block, 'pubDate')),
      source: sourceBlock ? stripTags(sourceBlock) : null,
      sourceUrl: sourceBlock ? extractAttr(sourceBlock, 'source', 'url') : null,
      guid: stripTags(extractTag(block, 'guid')) || null,
    };
  });
}

export function parseUtcIso(value: string): string | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  const dateOnly = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly) {
    const fallback = new Date(`${dateOnly}T00:00:00.000Z`);
    if (!Number.isNaN(fallback.getTime())) return fallback.toISOString();
  }
  return null;
}

export function utcDate(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

export function isInWindow(iso: string | null, window: UtcWindow): boolean {
  if (!iso) return false;
  return iso >= window.start && iso < window.end;
}

export function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function titleDateKey(title: string, date: string | null): string {
  return `${normalizeTitle(title)}|${date ?? ''}`;
}

export function isCombinedDigest(title: string): boolean {
  return COMBINED_DIGEST_PATTERNS.some((pattern) => pattern.test(title));
}

export function isRelevant(title: string, source: string | null, company: string | null): boolean {
  if (company) return true;
  const haystack = `${title} ${source ?? ''}`;
  return RELEVANCE_KEYWORDS.some((pattern) => pattern.test(haystack));
}

function isPrivateAddress(address: string): boolean {
  // Lightweight guard; production extraction module has a fuller version.
  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)) return true;
  if (address === '::1' || address.toLowerCase().startsWith('fc') || address.toLowerCase().startsWith('fd')) return true;
  return false;
}

export function isSafePublicHttpsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.local')) return false;
    if (isPrivateAddress(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function publisherDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function titleSimilarity(a: string, b: string): number {
  const left = new Set(normalizeTitle(a).split(/\s+/).filter((w) => w.length > 2));
  const right = new Set(normalizeTitle(b).split(/\s+/).filter((w) => w.length > 2));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

export interface FetchWithRetryOptions {
  fetchImpl: typeof fetch;
  timeoutMs: number;
  maxAttempts: number;
  baseBackoffMs: number;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await options.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
      if (response.ok) return response;
      if ((response.status === 429 || response.status >= 500) && attempt < options.maxAttempts - 1) {
        const retryAfter = response.headers.get('retry-after');
        let delayMs = options.baseBackoffMs * 2 ** attempt;
        if (retryAfter) {
          const seconds = Number(retryAfter);
          if (Number.isFinite(seconds)) delayMs = Math.max(delayMs, seconds * 1000);
        }
        await sleep(Math.min(delayMs, 15000));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < options.maxAttempts - 1) {
        await sleep(Math.min(options.baseBackoffMs * 2 ** attempt, 15000));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Fetch failed');
}

export async function fetchText(
  url: string,
  options: FetchWithRetryOptions,
  maxBytes: number,
): Promise<{ response: Response; text: string }> {
  const response = await fetchWithRetry(url, options, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  const raw = await response.text();
  return { response, text: raw.slice(0, maxBytes) };
}

function collectMeta(html: string): Map<string, string> {
  const meta = new Map<string, string>();
  const patterns = [
    /<meta\b[^>]*\b(?:property|name)=["']([^"']+)["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/gi,
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\b(?:property|name)=["']([^"']+)["'][^>]*>/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      if (pattern === patterns[0]) {
        meta.set(match[1].toLowerCase(), decodeHtmlEntities(match[2]));
      } else {
        meta.set(match[2].toLowerCase(), decodeHtmlEntities(match[1]));
      }
    }
  }
  return meta;
}

function extractCanonical(html: string, finalUrl: string): string | null {
  const patterns = [
    /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i,
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  const meta = collectMeta(html);
  return meta.get('og:url') ?? null;
}

function extractTitle(html: string): string | null {
  const meta = collectMeta(html);
  const ogTitle = meta.get('og:title') ?? meta.get('twitter:title');
  if (ogTitle) return stripTags(ogTitle);
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? stripTags(titleMatch[1]) : null;
}

function extractPublishedAt(html: string): string | null {
  const meta = collectMeta(html);
  const candidates = [
    meta.get('article:published_time'),
    meta.get('og:article:published_time'),
    meta.get('article:published'),
    meta.get('publishdate'),
    meta.get('pubdate'),
    meta.get('date'),
    meta.get('dc.date'),
    meta.get('dc.date.issued'),
    meta.get('dc.date.created'),
    meta.get('parsely-pub-date'),
  ];
  for (const candidate of candidates) {
    const parsed = candidate ? parseUtcIso(candidate) : null;
    if (parsed) return parsed;
  }
  const timeMatch = html.match(/<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>/i);
  if (timeMatch?.[1]) {
    const parsed = parseUtcIso(timeMatch[1]);
    if (parsed) return parsed;
  }
  const jsonLdMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (jsonLdMatch?.[1]) {
    const parsed = parseUtcIso(jsonLdMatch[1]);
    if (parsed) return parsed;
  }
  return null;
}

const GARTURLREQ_CTX = [
  ['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
  'X',
  'X',
  1,
  [1, 1, 1],
  1,
  1,
  null,
  0,
  0,
  null,
  0,
];

export function extractArticleId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.hostname !== 'news.google.com') return null;
    if (parts.length < 2) return null;
    if (parts[parts.length - 2] !== 'articles' && parts[parts.length - 2] !== 'read') return null;
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

export function parseSignature(html: string): { signature: string; timestamp: string } | null {
  const sgMatch = html.match(/data-n-a-sg="([^"]+)"/);
  const tsMatch = html.match(/data-n-a-ts="([^"]+)"/);
  if (sgMatch?.[1] && tsMatch?.[1]) {
    return { signature: sgMatch[1], timestamp: tsMatch[1] };
  }
  return null;
}

export function buildBatchexecuteBody(articleId: string, timestamp: string, signature: string): string {
  const inner = [
    'garturlreq',
    GARTURLREQ_CTX,
    articleId,
    /^\d+$/.test(timestamp) ? Number(timestamp) : timestamp,
    signature,
  ];
  const envelopes = [['Fbv4je', JSON.stringify(inner), null, '0']];
  return `f.req=${encodeURIComponent(JSON.stringify([envelopes]))}`;
}

export function parseBatchexecute(text: string): string | null {
  let body = text;
  if (body.includes('\n\n')) body = body.split('\n\n', 2)[1] ?? body;
  body = body.trim();
  if (body.startsWith(")]}'")) {
    const newlineIndex = body.indexOf('\n');
    body = newlineIndex >= 0 ? body.slice(newlineIndex + 1) : body.slice(4);
  }
  body = body.trim();
  let rows: unknown;
  try {
    rows = JSON.parse(body);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 3) continue;
    if (row[0] !== 'wrb.fr' && row[1] !== 'Fbv4je') continue;
    let payload: unknown = row[2];
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        continue;
      }
    }
    if (Array.isArray(payload) && payload[0] === 'garturlres' && typeof payload[1] === 'string') {
      return payload[1];
    }
  }
  return null;
}

export async function resolvePublisherUrl(
  googleUrl: string,
  articleHtml: string,
  fetchOptions: FetchWithRetryOptions,
): Promise<string | null> {
  let finalUrl: string | null = null;
  try {
    finalUrl = new URL(googleUrl).toString();
  } catch {
    return null;
  }
  // If the article fetch already resolved to a publisher URL, keep it.
  // (Handled by caller; this helper focuses on decoding.)
  const articleId = extractArticleId(googleUrl);
  const signature = parseSignature(articleHtml);
  if (!articleId || !signature) return null;
  try {
    const body = buildBatchexecuteBody(articleId, signature.timestamp, signature.signature);
    const response = await fetchWithRetry('https://news.google.com/_/DotsSplashUi/data/batchexecute', fetchOptions, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
    });
    const text = await response.text();
    return parseBatchexecute(text);
  } catch {
    return null;
  }
}


export async function validatePublisherPage(
  googleUrl: string,
  title: string,
  fetchOptions: FetchWithRetryOptions,
  maxBytes: number,
): Promise<{ publisherUrl: string | null; canonicalUrl: string | null; validation: PublisherValidation }> {
  const validation: PublisherValidation = {
    attempted: true,
    httpStatus: null,
    finalUrl: null,
    canonicalUrl: null,
    pageTitle: null,
    pagePublishedAt: null,
    titleMatch: false,
    valid: false,
    error: null,
    decoderAttempted: false,
    decoderSucceeded: false,
    decoderError: null,
    pageQuality: 'unknown',
    dateConflict: false,
  };

  let articleResponse: Response;
  let articleHtml = '';
  try {
    const result = await fetchText(googleUrl, fetchOptions, maxBytes);
    articleResponse = result.response;
    articleHtml = result.text;
  } catch (error) {
    validation.error = error instanceof Error ? error.message : 'Fetch failed';
    return { publisherUrl: null, canonicalUrl: null, validation };
  }

  validation.httpStatus = articleResponse.status;
  validation.finalUrl = articleResponse.url || null;
  if (articleResponse.status !== 200) {
    validation.error = `HTTP ${articleResponse.status}`;
    return { publisherUrl: validation.finalUrl, canonicalUrl: null, validation };
  }
  if (!validation.finalUrl || !isSafePublicHttpsUrl(validation.finalUrl)) {
    validation.error = 'Unsafe or non-HTTPS final URL';
    return { publisherUrl: validation.finalUrl, canonicalUrl: null, validation };
  }

  let publisherUrl = validation.finalUrl;
  const articleHost = new URL(publisherUrl).hostname;
  if (articleHost.includes('news.google.com')) {
    validation.decoderAttempted = true;
    const decoded = await resolvePublisherUrl(googleUrl, articleHtml, fetchOptions);
    if (decoded && isSafePublicHttpsUrl(decoded)) {
      publisherUrl = decoded;
      validation.decoderSucceeded = true;
    } else {
      validation.decoderError = 'Unable to decode Google News article URL';
    }
  }

  // Fetch the publisher page when we are not already on it.
  let publisherHtml = articleHtml;
  let publisherResponse: Response = articleResponse;
  if (publisherUrl !== validation.finalUrl) {
    try {
      const result = await fetchText(publisherUrl, fetchOptions, maxBytes);
      publisherResponse = result.response;
      publisherHtml = result.text;
      if (result.response.url && isSafePublicHttpsUrl(result.response.url)) {
        publisherUrl = result.response.url;
      }
    } catch (error) {
      validation.error = error instanceof Error ? error.message : 'Fetch failed';
      validation.finalUrl = publisherUrl;
      return { publisherUrl, canonicalUrl: null, validation };
    }
    validation.httpStatus = publisherResponse.status;
    if (publisherResponse.status !== 200) {
      validation.error = `HTTP ${publisherResponse.status}`;
      validation.finalUrl = publisherUrl;
      return { publisherUrl, canonicalUrl: null, validation };
    }
    if (!isSafePublicHttpsUrl(publisherUrl)) {
      validation.error = 'Unsafe or non-HTTPS final URL';
      validation.finalUrl = publisherUrl;
      return { publisherUrl, canonicalUrl: null, validation };
    }
  }

  validation.finalUrl = publisherUrl;
  if (new URL(publisherUrl).hostname.includes('news.google.com')) {
    validation.error = 'Did not resolve away from Google News';
    return { publisherUrl, canonicalUrl: null, validation };
  }

  const pageTitle = extractTitle(publisherHtml);
  const pagePublishedAt = extractPublishedAt(publisherHtml);
  const canonical = extractCanonical(publisherHtml, publisherUrl);
  validation.pageTitle = pageTitle;
  validation.pagePublishedAt = pagePublishedAt;
  validation.canonicalUrl = canonical;
  validation.titleMatch = pageTitle ? titleSimilarity(title, pageTitle) >= 0.25 : false;
  const canonicalUrl = canonical && isSafePublicHttpsUrl(canonical) ? canonical : publisherUrl;
  validation.canonicalUrl = canonicalUrl;
  validation.valid = Boolean(pageTitle);
  validation.pageQuality = classifyPageQuality(publisherHtml, publisherUrl, pageTitle);
  validation.dateConflict = hasDateConflict(null, pagePublishedAt); // RSS date supplied by caller later
  if (!pageTitle) validation.error = 'Missing publisher title';

  return {
    publisherUrl,
    canonicalUrl,
    validation,
  };
}

export function classifyPageQuality(
  html: string,
  finalUrl: string | null,
  title: string | null,
): 'news' | 'possible-news' | 'tutorial' | 'seo' | 'low-credibility' | 'unknown' {
  const lowerUrl = (finalUrl ?? '').toLowerCase();
  const lowerTitle = (title ?? '').toLowerCase();
  const text = `${lowerUrl} ${lowerTitle} ${html.slice(0, 2000).toLowerCase()}`;
  if (/\/(tutorial|how-to|guide|docs?|documentation|learn)\b/.test(lowerUrl) || /\b(tutorial|how to|step[- ]by[- ]step|beginner guide)\b/.test(lowerTitle)) {
    return 'tutorial';
  }
  if (/\b(seo|best .* tools|top \d+|affiliate|sponsored)\b/.test(text)) return 'seo';
  const lowHosts = ['medium.com', 'substack.com', 'dev.to', 'hashnode.com'];
  if (finalUrl && lowHosts.some((host) => new URL(finalUrl).hostname.includes(host)) && !/\b(announce|launch|release|funding|policy)\b/.test(lowerTitle)) {
    return 'low-credibility';
  }
  if (/\b(news|press|announcement|launch|release|funding|policy|research)\b/.test(lowerTitle)) return 'news';
  return 'possible-news';
}

export function hasDateConflict(rssPublishedAt: string | null, pagePublishedAt: string | null, toleranceHours = 36): boolean {
  if (!rssPublishedAt || !pagePublishedAt) return false;
  const left = Date.parse(rssPublishedAt);
  const right = Date.parse(pagePublishedAt);
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  return Math.abs(left - right) > toleranceHours * 60 * 60 * 1000;
}

export function isHeldReason(reason: string): boolean {
  return reason.startsWith('publisher-') || reason === 'publication-date-conflict' || reason === 'publisher-url-unresolved';
}
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

export interface DiscoveryEventGroup {
  id: string;
  key: string;
  company: string | null;
  candidateIds: string[];
  size: number;
}

export function groupDiscoveryEvents(candidates: DiscoveryCandidate[]): DiscoveryEventGroup[] {
  const groups: { company: string | null; members: DiscoveryCandidate[] }[] = [];
  const sorted = [...candidates].sort((a, b) => {
    const left = a.publishedAtUtc ? Date.parse(a.publishedAtUtc) : 0;
    const right = b.publishedAtUtc ? Date.parse(b.publishedAtUtc) : 0;
    return left - right;
  });
  for (const candidate of sorted) {
    const existing = groups.find((group) => {
      if (group.company !== candidate.company) return false;
      return group.members.some((member) => {
        const sameDayWindow =
          !member.publishedAtUtc || !candidate.publishedAtUtc ||
          Math.abs(Date.parse(member.publishedAtUtc) - Date.parse(candidate.publishedAtUtc)) <= 3 * 24 * 60 * 60 * 1000;
        return sameDayWindow && titleSimilarity(member.title, candidate.title) >= 0.6;
      });
    });
    if (existing) existing.members.push(candidate);
    else groups.push({ company: candidate.company, members: [candidate] });
  }
  return groups.map((group, index) => {
    const id = `event-${index + 1}`;
    for (const member of group.members) member.eventGroupId = id;
    return {
      id,
      key: `${group.company ?? 'unknown'}:${group.members.map((m) => normalizeTitle(m.title)).join('|')}`,
      company: group.company,
      candidateIds: group.members.map((member) => member.id),
      size: group.members.length,
    };
  });
}


export async function runDiscovery(options: DiscoveryRunOptions): Promise<DiscoveryResult> {
  const startedAt = Date.now();
  const queries = options.queries ?? DISCOVERY_QUERIES;
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxConcurrency = options.maxConcurrency ?? 4;
  const queryTimeoutMs = options.queryTimeoutMs ?? 10000;
  const publisherTimeoutMs = options.publisherTimeoutMs ?? 8000;
  const maxPublisherBytes = options.maxPublisherBytes ?? 1_000_000;
  const validatePublishers = options.validatePublishers ?? true;
  const retryMaxAttempts = options.retryMaxAttempts ?? 2;
  const baseBackoffMs = options.baseBackoffMs ?? 500;
  const window = options.window;

  const fetchOptionsForQuery: FetchWithRetryOptions = {
    fetchImpl,
    timeoutMs: queryTimeoutMs,
    maxAttempts: retryMaxAttempts,
    baseBackoffMs,
  };

  const perQuery: DiscoveryMetrics['perQuery'] = {};
  for (const query of queries) perQuery[query.id] = { raw: 0, inWindow: 0, accepted: 0, held: 0 };

  const queryErrors: { queryId: string; error: string }[] = [];
  let queriesSucceeded = 0;
  let queriesFailed = 0;
  const rawCandidates: DiscoveryCandidate[] = [];

  await mapWithConcurrency(queries, maxConcurrency, async (query) => {
    try {
      const response = await fetchWithRetry(buildGoogleNewsUrl(query.query), fetchOptionsForQuery);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      const items = parseGoogleNewsRss(xml);
      queriesSucceeded += 1;
      perQuery[query.id].raw = items.length;

      for (const item of items) {
        const publishedAtUtc = parseUtcIso(item.pubDate);
        const eventDate = utcDate(publishedAtUtc);
        const company = extractCompany({ title: item.title, source: item.source }) ?? null;
        const topic = classifyStoryTopic({ title: item.title, summary: item.source, fallbackTopic: 'Products' });
        const candidate: DiscoveryCandidate = {
          id: canonicalizeUrl(item.link) || item.guid || titleDateKey(item.title, eventDate),
          queryId: query.id,
          queryLabel: query.label,
          query: query.query,
          googleNewsUrl: item.link,
          title: item.title,
          source: item.source,
          publishedAtUtc,
          eventDate,
          company,
          topic,
          combinedDigest: isCombinedDigest(item.title),
          relevance: isRelevant(item.title, item.source, company) ? 'relevant' : 'low',
    publisherUrl: null,
    canonicalUrl: null,
    publisherUrlSource: null,
    publisherValidation: {
      attempted: false,
      httpStatus: null,
      finalUrl: null,
      canonicalUrl: null,
      pageTitle: null,
      pagePublishedAt: null,
      titleMatch: false,
      valid: false,
      error: null,
      decoderAttempted: false,
      decoderSucceeded: false,
      decoderError: null,
      pageQuality: 'unknown',
      dateConflict: false,
    },
    rejectionReasons: [],
    status: 'rejected',
    reviewDisposition: 'reject',
    eventGroupId: null,
    pageQuality: 'unknown',
    dateConflict: false,
  };

        if (!candidate.title) candidate.rejectionReasons.push('missing-title');
        if (!candidate.publishedAtUtc) candidate.rejectionReasons.push('missing-or-invalid-date');
        if (candidate.publishedAtUtc && !isInWindow(candidate.publishedAtUtc, window)) {
          candidate.rejectionReasons.push('out-of-window');
        }
        if (candidate.combinedDigest) candidate.rejectionReasons.push('combined-digest');
        if (candidate.relevance === 'low') candidate.rejectionReasons.push('low-relevance');

        if (candidate.publishedAtUtc && isInWindow(candidate.publishedAtUtc, window)) {
          perQuery[query.id].inWindow += 1;
        }
        rawCandidates.push(candidate);
      }
    } catch (error) {
      queriesFailed += 1;
      queryErrors.push({
        queryId: query.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  const seenRawKeys = new Set<string>();
  for (const candidate of rawCandidates) {
    const key = candidate.googleNewsUrl
      ? `google:${canonicalizeUrl(candidate.googleNewsUrl)}`
      : `title:${titleDateKey(candidate.title, candidate.eventDate)}`;
    if (seenRawKeys.has(key)) {
      candidate.rejectionReasons.push('duplicate-google-news-item');
    } else {
      seenRawKeys.add(key);
    }
  }

  const validateTargets = rawCandidates.filter(
    (candidate) =>
      !candidate.rejectionReasons.includes('missing-title') &&
      !candidate.rejectionReasons.includes('missing-or-invalid-date') &&
      !candidate.rejectionReasons.includes('out-of-window') &&
      !candidate.rejectionReasons.includes('duplicate-google-news-item'),
  );

  if (validatePublishers) {
    const fetchOptionsForPublisher: FetchWithRetryOptions = {
      fetchImpl,
      timeoutMs: publisherTimeoutMs,
      maxAttempts: retryMaxAttempts,
      baseBackoffMs,
    };
    await mapWithConcurrency(validateTargets, maxConcurrency, async (candidate) => {
      candidate.publisherValidation.attempted = true;
      const result = await validatePublisherPage(
        candidate.googleNewsUrl,
        candidate.title,
        fetchOptionsForPublisher,
        maxPublisherBytes,
      );
      candidate.publisherUrl = result.publisherUrl;
      candidate.canonicalUrl = result.canonicalUrl;
      candidate.publisherValidation = result.validation;
      if (result.validation.decoderAttempted) {
        candidate.publisherValidation.decoderAttempted = result.validation.decoderAttempted;
        candidate.publisherValidation.decoderSucceeded = result.validation.decoderSucceeded;
        candidate.publisherValidation.decoderError = result.validation.decoderError;
      }
      if (result.publisherUrl && new URL(result.publisherUrl).hostname.includes('news.google.com')) {
        candidate.publisherUrlSource = 'google-news-held';
      } else if (result.validation.decoderSucceeded) {
        candidate.publisherUrlSource = 'decoded';
      } else if (result.publisherUrl && result.publisherUrl !== candidate.googleNewsUrl) {
        candidate.publisherUrlSource = 'redirect';
      } else {
        candidate.publisherUrlSource = 'not-attempted';
      }
      if (!result.validation.valid) {
        candidate.rejectionReasons.push('publisher-page-invalid');
      }
      if (result.validation.httpStatus !== 200 && result.validation.httpStatus !== null) {
        candidate.rejectionReasons.push('publisher-inaccessible');
        candidate.rejectionReasons.push(`publisher-inaccessible-http-${result.validation.httpStatus}`);
      }
      if (result.validation.error && /timeout|abort/i.test(result.validation.error)) {
        if (!candidate.rejectionReasons.includes('publisher-inaccessible')) {
          candidate.rejectionReasons.push('publisher-inaccessible');
        }
        candidate.rejectionReasons.push('publisher-inaccessible-timeout');
      }
      if (result.validation.pagePublishedAt && !isInWindow(result.validation.pagePublishedAt, window)) {
        candidate.rejectionReasons.push('publisher-date-out-of-window');
      }
      candidate.pageQuality = result.validation.pageQuality;
      candidate.dateConflict = hasDateConflict(candidate.publishedAtUtc, result.validation.pagePublishedAt);
      if (candidate.dateConflict) candidate.rejectionReasons.push('publication-date-conflict');
      if (['tutorial', 'seo', 'low-credibility'].includes(candidate.pageQuality)) {
        candidate.rejectionReasons.push(`${candidate.pageQuality}-page`);
      }
      if (result.publisherUrl && new URL(result.publisherUrl).hostname.includes('news.google.com') && !result.validation.decoderSucceeded) {
        candidate.rejectionReasons.push('publisher-url-unresolved');
      }
    });
  } else {
    for (const candidate of validateTargets) {
      candidate.publisherUrl = candidate.googleNewsUrl;
      candidate.canonicalUrl = candidate.googleNewsUrl;
      candidate.publisherUrlSource = 'not-attempted';
      candidate.publisherValidation.attempted = false;
      candidate.pageQuality = 'unknown';
    }
  }

  const seenCanonical = new Set<string>();
  const seenTitleDate = new Set<string>();
  for (const candidate of rawCandidates) {
    const eligible = candidate.rejectionReasons.length === 0;
    const canonicalKey = candidate.canonicalUrl ? canonicalizeUrl(candidate.canonicalUrl) : null;
    if (eligible && canonicalKey) {
      if (seenCanonical.has(canonicalKey)) {
        candidate.rejectionReasons.push('duplicate-canonical-url');
      } else {
        seenCanonical.add(canonicalKey);
      }
    }
    const tdKey = titleDateKey(candidate.title, candidate.eventDate);
    if (eligible && !candidate.rejectionReasons.includes('duplicate-canonical-url')) {
      if (seenTitleDate.has(tdKey)) {
        candidate.rejectionReasons.push('duplicate-title-date');
      } else {
        seenTitleDate.add(tdKey);
      }
    }
  }

  for (const candidate of rawCandidates) {
    const held = candidate.rejectionReasons.some(isHeldReason);
    candidate.status = candidate.rejectionReasons.length === 0
      ? 'accepted'
      : held
        ? 'held'
        : 'rejected';
    candidate.reviewDisposition = candidate.status === 'accepted'
      ? 'publish'
      : candidate.status === 'held'
        ? 'hold-for-human-review'
        : 'reject';
    if (candidate.status === 'accepted') {
      perQuery[candidate.queryId].accepted += 1;
    } else if (candidate.status === 'held') {
      perQuery[candidate.queryId].held += 1;
    }
  }
  const eventGroupsList = groupDiscoveryEvents(rawCandidates);
  const multiSourceEventGroups = eventGroupsList.filter((group) => group.size > 1).length;
  const groupedCandidates = eventGroupsList
    .filter((group) => group.size > 1)
    .reduce((sum, group) => sum + group.size, 0);

  const duplicateReasons = new Set([
    'duplicate-google-news-item',
    'duplicate-canonical-url',
    'duplicate-title-date',
  ]);
  const rawItems = rawCandidates.length;
  const inWindowCount = rawCandidates.filter((c) => c.publishedAtUtc && isInWindow(c.publishedAtUtc, window)).length;
  const outOfWindow = rawCandidates.filter((c) => c.rejectionReasons.includes('out-of-window')).length;
  const missingMetadata = rawCandidates.filter(
    (c) => c.rejectionReasons.includes('missing-title') || c.rejectionReasons.includes('missing-or-invalid-date'),
  ).length;
  const duplicates = rawCandidates.filter((c) => c.rejectionReasons.some((r) => duplicateReasons.has(r))).length;
  const lowRelevance = rawCandidates.filter((c) => c.rejectionReasons.includes('low-relevance')).length;
  const combinedDigests = rawCandidates.filter((c) => c.rejectionReasons.includes('combined-digest')).length;
  const inaccessiblePublishers = rawCandidates.filter(
    (c) =>
      c.rejectionReasons.includes('publisher-inaccessible') ||
      c.rejectionReasons.includes('publisher-page-invalid') ||
      c.rejectionReasons.includes('publisher-date-out-of-window'),
  ).length;
  const uniqueCandidates = rawCandidates.filter((c) => !c.rejectionReasons.some((r) => duplicateReasons.has(r))).length;
  const heldCandidates = rawCandidates.filter((c) => c.status === 'held').length;
  const missingCompany = rawCandidates.filter((c) => !c.company).length;
  const candidatesWithCompany = rawCandidates.filter((c) => Boolean(c.company)).length;
  const acceptedWithCompany = rawCandidates.filter((c) => c.status === 'accepted' && Boolean(c.company)).length;
  const pageQualityCounts: Record<string, number> = {};
  for (const candidate of rawCandidates) {
    pageQualityCounts[candidate.pageQuality] = (pageQualityCounts[candidate.pageQuality] ?? 0) + 1;
  }
  const dateConflicts = rawCandidates.filter((c) => c.dateConflict).length;
  const decoderAttemptedCount = rawCandidates.filter((c) => c.publisherValidation.decoderAttempted).length;
  const decoderSucceededCount = rawCandidates.filter((c) => c.publisherValidation.decoderSucceeded).length;
  const decoderUnresolvedCount = rawCandidates.filter((c) => c.rejectionReasons.includes('publisher-url-unresolved')).length;
  const acceptedCandidates = rawCandidates.filter((c) => c.status === 'accepted').length;

  const publisherValidationAttempted = rawCandidates.filter((c) => c.publisherValidation.attempted).length;
  const publisherValidationOk = rawCandidates.filter((c) => c.publisherValidation.valid).length;
  const publisherValidationFailed = publisherValidationAttempted - publisherValidationOk;

  const perCompany: Record<string, number> = {};
  for (const candidate of rawCandidates) {
    if (candidate.status === 'accepted' && candidate.company) {
      perCompany[candidate.company] = (perCompany[candidate.company] ?? 0) + 1;
    }
  }

  const metrics: DiscoveryMetrics = {
    window,
    queries: {
      total: queries.length,
      succeeded: queriesSucceeded,
      failed: queriesFailed,
      errors: queryErrors,
    },
    rawItems,
    inWindow: inWindowCount,
    outOfWindow,
    missingMetadata,
    missingCompany,
    duplicates,
    lowRelevance,
    combinedDigests,
    inaccessiblePublishers,
    heldCandidates,
    uniqueCandidates,
    acceptedCandidates,
    publisherValidation: {
      attempted: publisherValidationAttempted,
      ok: publisherValidationOk,
      failed: publisherValidationFailed,
      held: heldCandidates,
    },
    perQuery,
    perCompany,
    companyExtraction: {
      candidatesWithCompany,
      acceptedWithCompany,
      candidateCoverage: rawCandidates.length ? candidatesWithCompany / rawCandidates.length : 0,
      acceptedCoverage: acceptedCandidates ? acceptedWithCompany / acceptedCandidates : 0,
    },
    pageQuality: pageQualityCounts,
    dateConflicts,
    eventGroups: eventGroupsList.length,
    multiSourceEventGroups,
    groupedCandidates,
    decoder: {
      attempted: decoderAttemptedCount,
      succeeded: decoderSucceededCount,
      failed: decoderAttemptedCount - decoderSucceededCount,
      unresolved: decoderUnresolvedCount,
    },
    runtimeMs: Date.now() - startedAt,
  };

  return { candidates: rawCandidates, metrics };
}

export interface DiscoveryCandidateComparison {
  leftCount: number;
  rightCount: number;
  intersectionTitles: string[];
  intersectionCanonicalUrls: string[];
  leftOnlyTitles: string[];
  rightOnlyTitles: string[];
  intersectionCandidates: DiscoveryCandidate[];
  leftOnlyCandidates: DiscoveryCandidate[];
  rightOnlyCandidates: DiscoveryCandidate[];
  genuinelyNewRelevantAnnouncements: DiscoveryCandidate[];
}

function candidateTitleKey(candidate: DiscoveryCandidate): string {
  return normalizeTitle(candidate.title);
}

function candidateCanonicalKey(candidate: DiscoveryCandidate): string | null {
  return candidate.canonicalUrl ? canonicalizeUrl(candidate.canonicalUrl) : null;
}

function inOtherByTitleOrCanonical(candidate: DiscoveryCandidate, others: DiscoveryCandidate[]): boolean {
  const title = candidateTitleKey(candidate);
  const canonical = candidateCanonicalKey(candidate);
  return others.some((other) => {
    if (candidateTitleKey(other) === title) return true;
    const otherCanonical = candidateCanonicalKey(other);
    return Boolean(canonical && otherCanonical && canonical === otherCanonical);
  });
}

export function compareDiscoveryCandidates(
  left: DiscoveryCandidate[],
  right: DiscoveryCandidate[],
): DiscoveryCandidateComparison {
  const leftAccepted = left.filter((candidate) => candidate.status === 'accepted');
  const rightAccepted = right.filter((candidate) => candidate.status === 'accepted');
  const intersectionCandidates = rightAccepted.filter((candidate) => inOtherByTitleOrCanonical(candidate, leftAccepted));
  const leftOnlyCandidates = leftAccepted.filter((candidate) => !inOtherByTitleOrCanonical(candidate, rightAccepted));
  const rightOnlyCandidates = rightAccepted.filter((candidate) => !inOtherByTitleOrCanonical(candidate, leftAccepted));
  const genuinelyNewRelevantAnnouncements = rightOnlyCandidates.filter(
    (candidate) => candidate.relevance === 'relevant',
  );
  return {
    leftCount: leftAccepted.length,
    rightCount: rightAccepted.length,
    intersectionTitles: intersectionCandidates.map((candidate) => normalizeTitle(candidate.title)),
    intersectionCanonicalUrls: intersectionCandidates
      .map((candidate) => candidate.canonicalUrl)
      .filter((url): url is string => Boolean(url))
      .map((url) => canonicalizeUrl(url)),
    leftOnlyTitles: leftOnlyCandidates.map((candidate) => normalizeTitle(candidate.title)),
    rightOnlyTitles: rightOnlyCandidates.map((candidate) => normalizeTitle(candidate.title)),
    intersectionCandidates,
    leftOnlyCandidates,
    rightOnlyCandidates,
    genuinelyNewRelevantAnnouncements,
  };
}

export function compareDiscoveryResults(
  left: DiscoveryResult,
  right: DiscoveryResult,
): DiscoveryCandidateComparison {
  return compareDiscoveryCandidates(left.candidates, right.candidates);
}

export const compareDiscoveryRuns = compareDiscoveryResults;


export function defaultUtcWindow(hours = 24, now = new Date()): UtcWindow {
  const end = new Date(now);
  const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

