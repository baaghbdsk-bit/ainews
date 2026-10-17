import { extractFromHtml } from '@extractus/article-extractor';

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

export interface ExtractedArticle {
  /** Plain text, paragraphs separated by a blank line. */
  body: string;
  /** A richer 2–3 sentence lead, better than the terse feed excerpt. */
  summary: string;
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
    const wait = (hostNextAt.get(host) ?? 0) - Date.now();
    if (wait > 0) await sleep(wait);
    hostNextAt.set(host, Date.now() + MIN_HOST_GAP_MS);
    return fn();
  });
  hostChains.set(host, run.catch(() => undefined));
  return run;
}

type FetchResult =
  | { kind: 'ok'; html: string }
  | { kind: 'rate-limited' }
  | { kind: 'unavailable' };

async function fetchHtml(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    });
    if (res.status === 429) return { kind: 'rate-limited' };
    if (!res.ok) return { kind: 'unavailable' };

    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('html')) return { kind: 'unavailable' };

    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_HTML_BYTES) return { kind: 'unavailable' };

    const html = await res.text();
    return html.length > MAX_HTML_BYTES ? { kind: 'unavailable' } : { kind: 'ok', html };
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

  const fetched = await runOnHost(parsed.host, () => fetchHtml(parsed.toString()));
  if (fetched.kind === 'rate-limited') return { status: 'rate-limited' };
  if (fetched.kind !== 'ok') return { status: 'unavailable' };

  let article;
  try {
    article = await extractFromHtml(fetched.html, parsed.toString());
  } catch {
    return { status: 'unavailable' };
  }
  if (!article?.content) return { status: 'unavailable' };

  const paragraphs = htmlToParagraphs(article.content);
  let body = paragraphs.join('\n\n');
  if (body.length < MIN_BODY_CHARS) return { status: 'unavailable' };
  if (body.length > MAX_BODY_CHARS) {
    body = body.slice(0, MAX_BODY_CHARS);
    const lastBreak = body.lastIndexOf('\n\n');
    if (lastBreak > MIN_BODY_CHARS) body = body.slice(0, lastBreak);
  }

  const summary = buildSummary(paragraphs);
  return { status: 'ok', article: { body, summary: summary || paragraphs[0] } };
}
