import { llmEnabled, llmJson } from './llm';

/**
 * Zero-cost extractive summarizer.
 *
 * Turns an extracted article into a short "deck" (2-4 sentences) that gives a
 * reader enough context from the timeline's expanded row — without an LLM, an
 * API key, or a per-story cost. It blends the publisher's own description
 * (og:description / meta description, which is human-written and usually the
 * single best gist) with the highest-signal sentences from the body.
 *
 * Scoring is a lexical frequency model: sentences that use many of the article's
 * salient words rank higher, earlier sentences get a bonus (news leads with the
 * point), and near-duplicate sentences are dropped so the deck doesn't repeat
 * itself.
 */

export interface DeckInput {
  title?: string;
  /** Publisher description: og:description or <meta name="description">. */
  description?: string;
  /** Extracted article paragraphs, in reading order. */
  paragraphs: string[];
}

const MAX_DECK_CHARS = 700;
const MAX_SENTENCES = 4;
const MIN_SENTENCE_CHARS = 50;
const MAX_SENTENCE_CHARS = 320;
const MIN_DESCRIPTION_CHARS = 80;
// Sentences sharing more than this fraction of words are treated as duplicates.
const DUPLICATE_OVERLAP = 0.5;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one', 'our',
  'out', 'his', 'has', 'had', 'how', 'its', 'who', 'use', 'with', 'that', 'this', 'from', 'they',
  'will', 'would', 'there', 'their', 'what', 'about', 'which', 'when', 'make', 'like', 'time',
  'just', 'know', 'take', 'into', 'your', 'some', 'them', 'than', 'then', 'only', 'come', 'here',
  'more', 'most', 'such', 'been', 'were', 'also', 'does', 'did', 'doing', 'being', 'have', 'having',
  'these', 'those', 'over', 'under', 'after', 'before', 'between', 'during', 'through', 'because',
  'while', 'where', 'very', 'same', 'each', 'other', 'another', 'many', 'much', 'even', 'still',
  'new', 'now', 'get', 'got', 'say', 'said', 'says', 'saw', 'see', 'seen', 'way', 'well', 'back',
  'first', 'last', 'next', 'two', 'three', 'may', 'might', 'must', 'should', 'could', 'let', 'us',
  'she', 'him', 'his', 'they', 'them', 'we', 'you', 'it', 'as', 'at', 'by', 'in', 'of', 'on', 'or',
  'to', 'up', 'so', 'if', 'no', 'do', 'an', 'is', 'be', 'he', 'we', 'my', 'me', 'i',
]);

const BOILERPLATE = new RegExp(
  [
    'subscribe', 'newsletter', 'sign ?up', 'sign-?up', 'cookie', 'advertis', 'read more',
    'all rights reserved', 'follow us', 'share this', 'posted by', 'listen to',
    'this (article|post|story) (was|is) (originally )?published', 'privacy policy',
    'terms of (use|service)', 'leave a (comment|reply)', 'click here',
  ].join('|'),
  'i',
);

/** Non-attribution lines publishers tack onto descriptions. */
const ATTRIBUTION = /\s*(a (blog|blog post|post|story|guest post) by .*? on .*?)$/i;

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x27;|&apos;/gi, "'")
    .replace(/&#x?0*8216;|&lsquo;/gi, '\u2018')
    .replace(/&#x?0*8217;|&rsquo;/gi, '\u2019')
    .replace(/&#x?0*8220;|&ldquo;/gi, '\u201c')
    .replace(/&#x?0*8221;|&rdquo;/gi, '\u201d')
    .replace(/&#x?0*8211;|&ndash;/gi, '\u2013')
    .replace(/&#x?0*8212;|&mdash;/gi, '\u2014')
    .replace(/&hellip;/gi, '\u2026')
    .replace(/&#\d+;/g, ' ');
}

function isBoilerplate(text: string): boolean {
  return BOILERPLATE.test(text);
}

function cleanDescription(description: string | undefined): string {
  if (!description) return '';
  let text = normalize(decodeEntities(description)).replace(ATTRIBUTION, '').trim();
  // Strip a trailing " - Site Name" / " | Site Name" suffix when it is short.
  text = text.replace(/\s+[|–—-]\s+[A-Za-z0-9 .&']{2,30}$/, '').trim();
  return text;
}

function splitSentences(text: string): string[] {
  return normalize(text)
    .split(/(?<=[.!?])["')\]]?\s+(?=[A-Z0-9(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function contentWords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
  return words.filter((word) => !STOPWORDS.has(word));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Picks the highest-signal sentences from the article body, in original order.
 */
function selectSentences(title: string, paragraphs: string[]): string[] {
  const titleWords = new Set(contentWords(title));

  const candidates: { text: string; index: number; words: Set<string> }[] = [];
  for (const paragraph of paragraphs) {
    for (const sentence of splitSentences(paragraph)) {
      if (sentence.length < MIN_SENTENCE_CHARS || sentence.length > MAX_SENTENCE_CHARS) continue;
      if (isBoilerplate(sentence)) continue;
      const words = new Set(contentWords(sentence));
      if (words.size < 5) continue;
      // Skip anything that is just restating the headline.
      if (titleWords.size >= 4 && jaccard(words, titleWords) > 0.6) continue;
      candidates.push({ text: sentence, index: candidates.length, words });
    }
  }
  if (candidates.length === 0) return [];

  // Salience: how often a sentence's words appear across the whole article.
  const frequency = new Map<string, number>();
  for (const candidate of candidates) {
    for (const word of candidate.words) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }

  const total = candidates.length;
  const scored = candidates.map((candidate) => {
    let sum = 0;
    for (const word of candidate.words) sum += frequency.get(word) ?? 0;
    const salience = sum / Math.sqrt(candidate.words.size);
    // Lead paragraphs carry the point; reward them heavily.
    const position = candidate.index < 4
      ? 1.8 - candidate.index * 0.2
      : 1 + 0.4 * (1 - candidate.index / total);
    return { ...candidate, score: salience * position };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: typeof scored = [];
  for (const candidate of scored) {
    if (selected.length >= MAX_SENTENCES) break;
    if (selected.some((picked) => jaccard(candidate.words, picked.words) > DUPLICATE_OVERLAP)) continue;
    selected.push(candidate);
  }

  selected.sort((a, b) => a.index - b.index);
  return selected.map((candidate) => candidate.text);
}

function trimToLength(text: string, max: number): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastStop = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '));
  return (lastStop > max * 0.5 ? clipped.slice(0, lastStop + 1) : clipped).trim();
}

/**
 * True when a description actually talks about this article. Many sites ship a
 * site-wide `og:description` (e.g. Hugging Face's mission statement) that says
 * nothing about the specific story; those are dropped in favour of the body.
 */
function isArticleSpecific(description: string, articleWords: Map<string, number>): boolean {
  if (articleWords.size < 20) return true; // too little body to judge
  const salient = new Set(
    [...articleWords.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => word),
  );
  let overlap = 0;
  for (const word of new Set(contentWords(description))) if (salient.has(word)) overlap++;
  return overlap >= 2;
}

/**
 * Distinctive (proper-noun-ish) words from the headline — multi-capitalised
 * names, acronyms, and non-initial capitalised words. Used to recognise a
 * description that names the article's actual subject ("Vercel", "Wahlberg").
 */
function distinctiveTitleWords(title: string): Set<string> {
  const tokens = title.match(/\b[A-Za-z][A-Za-z0-9.+-]*\b/g) ?? [];
  const set = new Set<string>();
  tokens.forEach((token, index) => {
    const isCapitalized = token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase();
    if (!isCapitalized) return;
    const hasInnerUpper = /[A-Z]/.test(token.slice(1));
    const isAcronym = token.length >= 2 && token === token.toUpperCase() && /[A-Z]/.test(token);
    if (index === 0 && !hasInnerUpper && !isAcronym) return; // sentence-initial word
    const lower = token.toLowerCase();
    if (STOPWORDS.has(lower)) return;
    set.add(lower);
  });
  return set;
}

/**
 * Builds a reader-facing deck: the publisher description (when it is
 * substantial, not boilerplate, and actually about this story) followed by the
 * top extractive sentences, de-duplicated and capped. Returns an empty string
 * when there is too little to work with, so callers can fall back.
 */
export function buildDeck({ title = '', description, paragraphs }: DeckInput): string {
  const parts: string[] = [];
  const seen: Set<string>[] = [];

  const articleWords = new Map<string, number>();
  for (const paragraph of paragraphs) {
    for (const word of contentWords(paragraph)) {
      articleWords.set(word, (articleWords.get(word) ?? 0) + 1);
    }
  }

  const clean = cleanDescription(description);
  const descWords = new Set(contentWords(clean));
  const distinctive = distinctiveTitleWords(title);
  const mentionsSubject = [...descWords].some((word) => distinctive.has(word));

  if (
    clean.length >= MIN_DESCRIPTION_CHARS &&
    !isBoilerplate(clean) &&
    descWords.size >= 8 &&
    (mentionsSubject || isArticleSpecific(clean, articleWords))
  ) {
    parts.push(/[.!?"'\u2019\u201d)\]]$/.test(clean) ? clean : `${clean}.`);
    seen.push(descWords);
  }

  for (const sentence of selectSentences(title, paragraphs)) {
    const words = new Set(contentWords(sentence));
    if (seen.some((existing) => jaccard(words, existing) > DUPLICATE_OVERLAP)) continue;
    parts.push(sentence);
    seen.push(words);
    if (parts.join(' ').length >= MAX_DECK_CHARS) break;
  }

  const deck = normalize(parts.join(' '));
  return trimToLength(deck, MAX_DECK_CHARS);
}

/** Join set of `paragraphs` into plain text — convenience for callers/tests. */
export function paragraphsFromBody(body: string): string[] {
  return body.split(/\n{2,}/).map(normalize).filter(Boolean);
}

// ---------------------------------------------------------------------------
// LLM tier (any OpenAI-compatible provider) with the extractive summarizer as a safety net.
// ---------------------------------------------------------------------------

export interface SummaryInput {
  title: string;
  /** Terse feed/DB excerpt — extra context, and the basis of the fallback. */
  summary?: string;
  /** Feed-derived significance, used only as a last-resort fallback deck. */
  significance?: string;
  /** Extracted article body (blank-line separated paragraphs), if any. */
  body?: string | null;
  source?: string;
}

export interface StorySummary {
  /** Always populated (LLM when available, else extractive). */
  deck: string;
  /** Short bullet takeaways (empty for the extractive fallback). */
  keyPoints: string[];
  whyItMatters: string | null;
  brief: string | null;
  /** Model id when the LLM produced this, else null (extractive). */
  model: string | null;
  /** True when the provider throttled us; the row should be retried later. */
  rateLimited: boolean;
  /** True when the LLM was enabled but the provider errored (unreachable/rejected). */
  providerFailed: boolean;
}

const MAX_PROMPT_BODY_CHARS = 8000;
const MAX_LLM_DECK_CHARS = 800;
const MIN_LLM_DECK_CHARS = 40;
const MAX_KEY_POINTS = 5;
const MAX_KEY_POINT_CHARS = 200;
const MAX_WHY_IT_MATTERS_CHARS = 400;
const MAX_BRIEF_CHARS = 4000;

const LLM_SYSTEM_PROMPT = [
  'You are a careful news editor for an AI-industry digest.',
  'You write tight, factual, neutral summaries and briefs.',
  'Use ONLY facts present in the supplied text.',
  'Never invent names, numbers, dates, quotes, or claims.',
  'If the text is thin, write less rather than guessing.',
  'Never use markdown. Respond with a single JSON object and nothing else.',
].join(' ');

function buildUserPrompt(input: SummaryInput): string {
  const body = (input.body ?? '').trim();
  const bodyText = body
    ? body.slice(0, MAX_PROMPT_BODY_CHARS)
    : '(full text unavailable — work from the headline and excerpt only)';

  return [
    `Headline: ${normalize(input.title)}`,
    input.source ? `Source: ${normalize(input.source)}` : '',
    input.summary ? `Excerpt: ${normalize(input.summary)}` : '',
    '',
    'Article text:',
    bodyText,
    '',
    'Return a single JSON object with exactly these keys:',
    '- "deck": 2-4 plain-text sentences (<= 600 characters) giving a reader the full context of this story.',
    '- "keyPoints": an array of 3-5 short plain-text bullet strings (<= 140 characters each).',
    '- "whyItMatters": 1-2 plain-text sentences on why this matters for the AI industry.',
    '- "brief": a 150-300 word neutral, professional brief as continuous prose (no markdown, no headings, no title line). Attribute claims to the source where natural.',
    'Use only facts from the text above.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function coerceSummaryJson(
  raw: unknown,
): Omit<StorySummary, 'model' | 'rateLimited' | 'providerFailed'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const deck = typeof obj.deck === 'string' ? normalize(obj.deck) : '';
  if (deck.length < MIN_LLM_DECK_CHARS) return null;

  const keyPoints = Array.isArray(obj.keyPoints)
    ? obj.keyPoints
        .filter((point): point is string => typeof point === 'string')
        .map((point) => trimToLength(normalize(point), MAX_KEY_POINT_CHARS))
        .filter((point) => point.length >= 3)
        .slice(0, MAX_KEY_POINTS)
    : [];

  const whyItMatters =
    typeof obj.whyItMatters === 'string' && normalize(obj.whyItMatters)
      ? trimToLength(normalize(obj.whyItMatters), MAX_WHY_IT_MATTERS_CHARS)
      : null;
  const brief =
    typeof obj.brief === 'string' && normalize(obj.brief)
      ? trimToLength(normalize(obj.brief), MAX_BRIEF_CHARS)
      : null;

  return { deck: trimToLength(deck, MAX_LLM_DECK_CHARS), keyPoints, whyItMatters, brief };
}

/** Builds the zero-cost summary used when the LLM is unavailable. */
export function extractiveSummary(input: SummaryInput): StorySummary {
  const paragraphs = input.body ? paragraphsFromBody(input.body) : [];
  const deck = buildDeck({ title: input.title, description: input.summary, paragraphs });
  const fallbackDeck =
    deck || trimToLength(normalize(input.summary ?? '') || normalize(input.significance ?? ''), 320);
  return { deck: fallbackDeck, keyPoints: [], whyItMatters: null, brief: null, model: null, rateLimited: false, providerFailed: false };
}

/**
 * Produces a reader-facing summary for a story. Prefers the grounded LLM tier
 * and transparently falls back to the extractive summarizer when
 * the key is absent, the provider errors, or it throttles us. Never throws.
 */
export async function summarizeArticle(input: SummaryInput): Promise<StorySummary> {
  if (!llmEnabled()) return extractiveSummary(input);

  const outcome = await llmJson(LLM_SYSTEM_PROMPT, buildUserPrompt(input));

  if (outcome.status === 'rate-limited') {
    return { ...extractiveSummary(input), rateLimited: true };
  }
  if (outcome.status === 'unavailable') {
    return { ...extractiveSummary(input), providerFailed: true };
  }
  // 'disabled' (key vanished mid-run) or a bad JSON shape: plain extractive.
  if (outcome.status !== 'ok') return extractiveSummary(input);

  const parsed = coerceSummaryJson(outcome.json);
  if (!parsed) return extractiveSummary(input);

  return { ...parsed, model: outcome.model, rateLimited: false, providerFailed: false };
}
