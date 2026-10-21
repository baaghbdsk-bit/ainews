import { extractFromHtml } from '@extractus/article-extractor';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Fetch a story's source page and extract its article text — zero cost, no API
 * keys. Runs inside the ingest job (never in a visitor's request), so the result
 * is stored once in Supabase and served from there.
 *
 * The feeds only carry a short excerpt, so this is what turns a one-line entry
 * into a readable article. Extraction uses a real readability pass; the result
 * is flattened to plain text (blank-line separated paragraphs) so it can be
 * rendered without ever injecting third-party HTML.
 *
 * Sites that block bots or render client-side (e.g. blog.google) report
 * `unavailable`; a source that throttles us (HTTP 429) reports `rate-limited`
 * so the job retries it later instead of counting it as a failure.
 */

// A browser-like UA — several publishers 403 the default fetch agent.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 8000;
// Redirects are followed manually so every hop can be checked against the
// private-address rules below.
const MAX_REDIRECTS = 5;
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);
// Space out requests to the same host so a burst can't trip a publisher's rate
// limiter (Hugging Face returns 429 after a handful of rapid hits).
const MIN_HOST_GAP_MS = 1200;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MIN_PARAGRAPH_CHARS = 60;
const MAX_PARAGRAPHS = 60;
const MAX_BODY_CHARS = 12000;
// Anything shorter than this is not worth showing as an "article" — fall back.
const MIN_BODY_CHARS = 400;
const SUMMARY_MAX_CHARS = 320;

/**
 * True for addresses that must never be fetched by the server: loopback,
 * RFC1918, link-local (including the 169.254.169.254 metadata endpoint),
 * CGNAT, multicast, and their IPv6 equivalents.
 */
function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return true;
    }
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }

  if (version === 6) {
    const value = address.toLowerCase();
    if (value === '::' || value === '::1') return true;
    if (value.startsWith('::ffff:')) return isPrivateAddress(value.slice(7));
    if (/^fe[89ab]/.test(value)) return true; // link-local fe80::/10
    if (value.startsWith('fc') || value.startsWith('fd')) return true; // unique local
    if (value.startsWith('ff')) return true; // multicast
    if (value.startsWith('2001:db8')) return true; // documentation range
    return false;
  }

  return true;
}

/** Resolves the host and requires every answer to be a public address. */
async function isPublicHttpsUrl(url: URL): Promise<boolean> {
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) return false;
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return false;
  }

  if (isIP(hostname)) return !isPrivateAddress(hostname);

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) return false;
    return addresses.every(({ address }) => !isPrivateAddress(address));
  } catch {
    return false;
  }
}

export interface ExtractedArticle {
  /** Plain text, paragraphs separated by a blank line. */
  body: string;
  /** A richer 2–3 sentence lead, better than the terse feed excerpt. */
  summary: string;
  /** Lead image (og:image / twitter:image), absolute https, or null. */
  imageUrl: string | null;
}

/**
 * Result of an extraction attempt. `rate-limited` is deliberately distinct from
 * `unavailable`: a 429 means the source is throttling us and the row should be
 * retried later, so the caller must not count it against the row's retry budget
 * (otherwise a burst permanently drops otherwise-readable stories).
 */
export type ExtractOutcome =
  | { status: 'ok'; article: ExtractedArticle }
  | { status: 'rate-limited' }
  | { status: 'unavailable' };

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x27;|&apos;/gi, "'")
    .replace(/&#82(17|16);|&[lr]squo;/gi, "'")
    .replace(/&#82(21|20);|&[lr]dquo;/gi, '"')
    .replace(/&#82(11|12);|&[nm]dash;/gi, '—')
    .replace(/&hellip;/gi, '…')
    .replace(/&#\d+;/g, ' ');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function htmlToParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const text = stripTags(match[1]);
    if (text.length >= MIN_PARAGRAPH_CHARS) paragraphs.push(text);
    if (paragraphs.length >= MAX_PARAGRAPHS) break;
  }
  return paragraphs;
}

/** First 2–3 sentences, capped — used to enrich the timeline summary. */
function buildSummary(paragraphs: string[]): string {
  const first = paragraphs[0] ?? '';
  if (!first) return '';
  const sentences = first.split(/(?<=[.!?])\s+/);
  let summary = '';
  for (const sentence of sentences) {
    if (summary && summary.length + sentence.length > SUMMARY_MAX_CHARS) break;
    summary = summary ? `${summary} ${sentence}` : sentence;
    if (summary.length >= SUMMARY_MAX_CHARS * 0.6) break;
  }
  return summary.slice(0, SUMMARY_MAX_CHARS).trim();
}

const hostChains = new Map<string, Promise<unknown>>();
const hostNextAt = new Map<string, number>();

// Tracking pixels, placeholder banners, and share cards that would look wrong in
// a timeline tile.
const IMAGE_URL_DENY = /(sprite|placeholder|1x1|pixel|spacer|blank\.(gif|png)|logo\.(svg|png)|favicon)/i;
const MAX_IMAGE_URL_CHARS = 1024;

/**
 * Resolves an image reference from page markup to an absolute https URL.
 * http references are upgraded to https when they point at the article's own
 * host (mixed content would be blocked anyway); otherwise they're dropped.
 */
function resolveImageUrl(raw: string, base: URL): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('data:') || IMAGE_URL_DENY.test(trimmed)) return null;
  let url: URL;
  try {
    url = new URL(trimmed, base);
  } catch {
    return null;
  }
  if (url.protocol === 'http:' && url.host === base.host) url.protocol = 'https:';
  if (url.protocol !== 'https:') return null;
  return url.toString().slice(0, MAX_IMAGE_URL_CHARS);
}

/** Lead image from `<meta>` tags, in the order publishers prioritise them. */
function leadImageFromHtml(html: string, base: URL): string | null {
  const byKey = new Map<string, string>();
  const metaRe = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRe.exec(html)) !== null) {
    const tag = match[0];
    const key = (/\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '').toLowerCase();
    if (!key) continue;
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (content && !byKey.has(key)) byKey.set(key, content);
  }

  const ordered = [
    'og:image:secure_url',
    'og:image:url',
    'og:image',
    'twitter:image',
    'twitter:image:src',
    'image',
  ];
  for (const key of ordered) {
    const raw = byKey.get(key);
    if (!raw) continue;
    const resolved = resolveImageUrl(raw, base);
    if (resolved) return resolved;
  }

  const linkMatch = /<link\b[^>]*>/gi;
  while ((match = linkMatch.exec(html)) !== null) {
    const tag = match[0];
    if (!/rel\s*=\s*["']image_src["']/i.test(tag)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (href) {
      const resolved = resolveImageUrl(href, base);
      if (resolved) return resolved;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn` under a per-host lock with a minimum gap between requests to the
 * same host. Distinct hosts still run concurrently, so overall throughput is
 * preserved while no single publisher gets hammered.
 */
function runOnHost<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const previous = hostChains.get(host) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(async () => {
    const now = performance.now();
    const wait = (hostNextAt.get(host) ?? 0) - now;
    if (wait > 0) await sleep(wait);
    hostNextAt.set(host, performance.now() + MIN_HOST_GAP_MS);
    return fn();
  });
  hostChains.set(host, run.catch(() => undefined));
  return run;
}

type FetchResult =
  | { kind: 'ok'; html: string; finalUrl: string }
  | { kind: 'rate-limited' }
  | { kind: 'unavailable' };

async function fetchHtml(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = new URL(url);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isPublicHttpsUrl(current))) {
        console.warn(`Refusing to fetch a non-public URL: ${current.toString()}`);
        return { kind: 'unavailable' };
      }

      const res = await runOnHost(current.host, () =>
        fetch(current, {
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
          next: { revalidate: 3600 },
        }),
      );

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return { kind: 'unavailable' };
        try {
          current = new URL(location, current);
        } catch {
          return { kind: 'unavailable' };
        }
        continue;
      }

      if (res.status === 429) return { kind: 'rate-limited' };
      if (!res.ok) return { kind: 'unavailable' };

      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('html')) return { kind: 'unavailable' };

      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > MAX_HTML_BYTES) return { kind: 'unavailable' };

      const html = await res.text();
      return html.length > MAX_HTML_BYTES
        ? { kind: 'unavailable' }
        : { kind: 'ok', html, finalUrl: current.toString() };
    }

    console.warn(`Too many redirects while fetching: ${url}`);
    return { kind: 'unavailable' };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn(`Article fetch timed out after ${FETCH_TIMEOUT_MS}ms: ${url}`);
    }
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the extracted article, or a status describing why it couldn't be
 * extracted. Never throws.
 */
export async function extractArticle(url: string): Promise<ExtractOutcome> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: 'unavailable' };
  }
  if (parsed.protocol !== 'https:') return { status: 'unavailable' };
  if (!(await isPublicHttpsUrl(parsed))) return { status: 'unavailable' };

  const fetched = await fetchHtml(parsed.toString());
  if (fetched.kind === 'rate-limited') return { status: 'rate-limited' };

  const finalUrl = fetched.kind === 'ok' ? new URL(fetched.finalUrl) : parsed;

  if (fetched.kind === 'ok') {
    let article;
    try {
      article = await extractFromHtml(fetched.html, finalUrl.toString());
    } catch {
      article = null;
    }

    if (article?.content) {
      const paragraphs = htmlToParagraphs(article.content);
      let body = paragraphs.join('\n\n');
      if (body.length >= MIN_BODY_CHARS) {
        if (body.length > MAX_BODY_CHARS) {
          body = body.slice(0, MAX_BODY_CHARS);
          const lastBreak = body.lastIndexOf('\n\n');
          if (lastBreak > MIN_BODY_CHARS) body = body.slice(0, lastBreak);
        }
        const summary = buildSummary(paragraphs);
        const imageUrl =
          leadImageFromHtml(fetched.html, finalUrl) ??
          resolveImageUrl(article.image ?? '', finalUrl);
        return { status: 'ok', article: { body, summary: summary || paragraphs[0], imageUrl } };
      }
    }
  }

  // Fallback: Zero-cost public reader proxy (r.jina.ai) to bypass bot blocking & client rendering.
  // Only a URL that already passed the public-https check is ever forwarded.
  const jinaArticle = await fetchWithJinaReader(parsed.toString());
  if (jinaArticle) {
    if (fetched.kind === 'ok') {
      jinaArticle.imageUrl = leadImageFromHtml(fetched.html, finalUrl);
    }
    return { status: 'ok', article: jinaArticle };
  }

  return { status: 'unavailable' };
}

/** Free fallback for client-rendered or bot-blocked sites. No API key needed. */
async function fetchWithJinaReader(url: string): Promise<ExtractedArticle | null> {
  let source: URL;
  try {
    source = new URL(url);
  } catch {
    return null;
  }
  if (!(await isPublicHttpsUrl(source))) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: {
        Accept: 'text/plain',
        'User-Agent': USER_AGENT,
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.length < MIN_BODY_CHARS) return null;

    const rawParagraphs = text
      .split(/\n{2,}/)
      .map((p) => p.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*`_]/g, '').trim())
      .filter((p) => p.length >= MIN_PARAGRAPH_CHARS && !p.toLowerCase().startsWith('http'));

    if (rawParagraphs.length === 0) return null;
    let body = rawParagraphs.slice(0, MAX_PARAGRAPHS).join('\n\n');
    if (body.length < MIN_BODY_CHARS) return null;
    if (body.length > MAX_BODY_CHARS) {
      body = body.slice(0, MAX_BODY_CHARS);
      const lastBreak = body.lastIndexOf('\n\n');
      if (lastBreak > MIN_BODY_CHARS) body = body.slice(0, lastBreak);
    }
    const summary = buildSummary(rawParagraphs);
    return { body, summary: summary || rawParagraphs[0], imageUrl: null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type ImageOutcome =
  | { status: 'ok'; imageUrl: string | null }
  | { status: 'rate-limited' }
  | { status: 'unavailable' };

/**
 * Fetches only a page's lead image, skipping the readability pass. Used to
 * backfill tiles for rows ingested before images were captured; `ok` with a null
 * `imageUrl` means the page genuinely has none, so callers can count an attempt
 * instead of refetching it forever.
 */
export async function fetchLeadImage(url: string): Promise<ImageOutcome> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: 'unavailable' };
  }
  if (parsed.protocol !== 'https:') return { status: 'unavailable' };

  const fetched = await runOnHost(parsed.host, () => fetchHtml(parsed.toString()));
  if (fetched.kind === 'rate-limited') return { status: 'rate-limited' };
  if (fetched.kind !== 'ok') return { status: 'unavailable' };
  return { status: 'ok', imageUrl: leadImageFromHtml(fetched.html, parsed) };
}
