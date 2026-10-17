import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseServiceRoleKey, supabaseUrl } from '@/lib/env';
import { llmEnabled, llmJson } from '@/lib/feeds/llm';
import type { Database, Json } from '@/lib/supabase/types';
import {
  coerceOutline,
  coerceSection,
  type DossierBlock,
  type DossierContent,
  type KeyFact,
  type SectionPlan,
  MAX_KEYFACTS,
} from './schema';
import { termPattern, type Entity } from './entities';

/**
 * Builds a dossier: a long-form, cited article about one entity, written only
 * from the stories we have already ingested and summarized.
 *
 * This is the piece that makes the site read like a publication rather than a
 * feed. The hard constraint is grounding: the writer is handed a numbered list
 * of real stories and may only cite those, so every claim in the finished
 * article traces back to a source we can link. Anything the model can't support
 * from the list is dropped rather than published.
 *
 * Generation is two-pass: first an outline (cheap, small output, never
 * truncates), then one LLM call per section. This keeps every call inside
 * free-tier token budgets and lets a single failing section be skipped instead
 * of killing the whole dossier.
 *
 * Like the story summarizer, this is strictly optional: with no LLM key
 * nothing is generated and the feature stays dormant.
 */

type Client = SupabaseClient<Database>;

// Outline pass: how many stories the writer may draw on.
const MAX_SOURCES = 18;
const CANDIDATE_LIMIT = MAX_SOURCES * 4;
// A source contributes at most this much text to the prompt.
const MAX_SOURCE_TEXT_CHARS = 1500;
// Sources thinner than this are dropped: a headline alone is not a source.
const MIN_SOURCE_TEXT_CHARS = 120;
// Per-call token budget — small enough that free tiers won't truncate.
const OUTLINE_MAX_TOKENS = 1500;
const SECTION_MAX_TOKENS = 1500;
const DOSSIER_TIMEOUT_MS = 90000;
// Near-duplicate dedupe: titles this similar within this many days are the
// same event retold by multiple outlets.
const DEDUPE_WINDOW_DAYS = 3;
const DEDUPE_TITLE_JACCARD = 0.6;

export type DossierOutcome =
  | { status: 'ok'; content: DossierContent; storyIds: string[]; model: string }
  | { status: 'empty' }
  | { status: 'rate-limited' }
  | { status: 'unavailable' }
  | { status: 'disabled' };

interface SourceRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  source: string;
  source_url: string;
  event_date: string;
  deck: string | null;
  brief: string | null;
  body: string | null;
  key_points: string[] | null;
  why_it_matters: string | null;
}

export interface DossierSource {
  id: string;
  slug: string;
  title: string;
  source: string;
  eventDate: string;
  /** Best available short text: generated brief/deck, else extracted body. */
  text: string;
  /** Already-condensed takeaways, used for the deterministic key-facts block. */
  keyPoints: string[];
}

function getSupabase(): Client {
  return createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseDate(value: string): number {
  const [y, m, d] = value.slice(0, 10).split('-').map((v) => Number(v));
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(a: string, b: string): number {
  return Math.floor(Math.abs(parseDate(a) - parseDate(b)) / 86400000);
}

const TITLE_STOP = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one', 'our',
  'out', 'his', 'has', 'had', 'how', 'its', 'who', 'use', 'with', 'that', 'this', 'from', 'they',
  'will', 'would', 'there', 'their', 'what', 'about', 'which', 'when', 'make', 'like', 'time',
]);

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3 && !TITLE_STOP.has(word)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * The stories that mention this entity, reduced to the fields the writer needs
 * and ordered by relevance, not just recency.
 *
 * Near-duplicate stories covering the same event (similar title within 3 days)
 * are collapsed so one announcement doesn't crowd out eight distinct
 * developments. The generated brief/deck is preferred over the raw body because
 * it's already condensed; a full body is truncated rather than fed whole.
 */
export async function loadDossierSources(entity: Entity): Promise<DossierSource[]> {
  const supabase = getSupabase();

  const filter = entity.terms
    .flatMap((term) => {
      const pattern = termPattern(term);
      return [`title.ilike.${pattern}`, `summary.ilike.${pattern}`, `body.ilike.${pattern}`];
    })
    .join(',');

  const { data, error } = await supabase
    .from('stories')
    .select(
      'id, slug, title, summary, source, source_url, event_date, deck, brief, body, key_points, why_it_matters',
    )
    .eq('status', 'published')
    .or(filter)
    .order('event_date', { ascending: false })
    .limit(CANDIDATE_LIMIT);

  if (error) {
    console.error(`Dossier source query failed for ${entity.slug}:`, error);
    return [];
  }

  const rows = (data ?? []) as SourceRow[];

  // 1. Collapse near-duplicate retellings of the same event (keep the newest).
  const kept: SourceRow[] = [];
  for (const row of rows) {
    const isDuplicate = kept.some(
      (existing) =>
        daysBetween(existing.event_date, row.event_date) <= DEDUPE_WINDOW_DAYS &&
        jaccard(titleWords(existing.title), titleWords(row.title)) > DEDUPE_TITLE_JACCARD,
    );
    if (!isDuplicate) kept.push(row);
  }

  // 2. Score by entity mention strength (title strongest) and recency.
  const newestDate = kept[0]?.event_date ?? '';
  const terms = entity.terms.map((term) => term.toLowerCase());
  const scored = kept.map((row) => {
    const titleLower = row.title.toLowerCase();
    const bodyLower = (
      row.summary +
      ' ' +
      (row.brief ?? '') +
      ' ' +
      (row.body ?? '')
    ).toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (titleLower.includes(term)) score += 3;
      if (bodyLower.includes(term)) score += 1;
    }
    score += Math.max(0, 7 - daysBetween(newestDate, row.event_date));
    return { row, score };
  });

  scored.sort((a, b) => b.score - a.score || daysBetween(b.row.event_date, a.row.event_date));

  // 3. Take the top sources and build the numbered list the writer sees.
  const sources: DossierSource[] = [];
  for (const { row } of scored) {
    if (sources.length >= MAX_SOURCES) break;
    const text = [row.brief, row.deck, row.body, row.summary]
      .find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)
      ?.replace(/\s+/g, ' ')
      .trim();
    if (!text || text.length < MIN_SOURCE_TEXT_CHARS) continue;
    sources.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      source: row.source,
      eventDate: row.event_date,
      text: text.slice(0, MAX_SOURCE_TEXT_CHARS),
      keyPoints: (row.key_points ?? []).filter((point): point is string => typeof point === 'string'),
    });
  }

  return sources;
}

const OUTLINE_SYSTEM = [
  'You are a senior editor writing a long-form article for an AI-industry digest.',
  'You are given a numbered list of real source stories. Write ONLY from those sources.',
  'Every factual claim must come from a source you cite by number.',
  'Never invent facts, figures, quotes, dates, or names. No customer/vendor testimonial quotes.',
  'Cite sources inline with bracketed numbers like [2].',
  'Prefer being shorter and accurate over longer and speculative.',
  'Never use markdown syntax (no #, *, _, or backticks).',
  'Respond with a single JSON object and nothing else.',
].join(' ');

function outlinePrompt(entity: Entity, sources: DossierSource[]): string {
  const list = sources
    .map(
      (source, index) =>
        `[${index + 1}] (${source.eventDate}, ${source.source}) ${source.title}\n${source.text}`,
    )
    .join('\n\n');

  return [
    `Create an outline for an article about: ${entity.label}.`,
    `Context: ${entity.about}`,
    '',
    'Sources:',
    list,
    '',
    'Return a single JSON object with exactly these keys:',
    '- "title": headline, plain text, <= 90 characters.',
    '- "subtitle": standfirst, plain text, <= 240 characters.',
    '- "sections": array of 3 to 7 sections, each:',
    '  { "heading": "...", "level": 2, "citations": [1, 3], "plan": "one sentence <= 200 chars" }',
    '',
    'Rules:',
    '- level 2 headings; use level 3 only for a sub-section.',
    '- each section must cite at least one source number from the list above.',
    '- order sections to build a narrative (chronology or theme).',
    '- title and subtitle contain no citations.',
  ].join('\n');
}

const SECTION_SYSTEM = [
  'You write one section of a grounded article.',
  'Use ONLY the numbered sources provided for this section.',
  'Cite inline with [n] using these exact section numbers.',
  'Never invent facts, figures, quotes, dates, or names.',
  'Never use markdown syntax.',
  'Respond with a single JSON object and nothing else.',
].join(' ');

function sectionPrompt(entity: Entity, section: SectionPlan, sources: DossierSource[]): string {
  const sectionSources = sources.filter((_, index) => section.citations.includes(index + 1));
  const list = sectionSources
    .map((source) => {
      const originalIndex = sources.indexOf(source) + 1;
      return `[${originalIndex}] (${source.eventDate}, ${source.source}) ${source.title}\n${source.text}`;
    })
    .join('\n\n');

  return [
    `Write the section "${section.heading}". Plan: ${section.plan}`,
    `Context: ${entity.about}`,
    '',
    'Sources for this section:',
    list,
    '',
    'Return a single JSON object with exactly these keys:',
    '- "paragraphs": array of 2 to 4 plain-text paragraphs, each <= 500 chars, with [n] citations.',
    '- "quotes": array of verbatim excerpts, each { "text": "...", "index": N }.',
    '',
    'Rules:',
    '- only cite source numbers shown above.',
    '- quotes must be copied verbatim from a cited source, with the matching index.',
    '- if the sources are thin or disagree, say so plainly instead of filling the gap.',
  ].join('\n');
}

/**
 * Writes a dossier for `entity` from its matching stories. Returns a status
 * describing why it couldn't be produced instead of throwing, mirroring the
 * feed/summarize passes.
 */
export async function buildDossier(entity: Entity): Promise<DossierOutcome> {
  if (!llmEnabled()) return { status: 'disabled' };

  const sources = await loadDossierSources(entity);
  if (sources.length === 0) return { status: 'empty' };

  // Pass 1: outline — cheap, small output, never truncates.
  const outlineOutcome = await llmJson(OUTLINE_SYSTEM, outlinePrompt(entity, sources), {
    maxTokens: OUTLINE_MAX_TOKENS,
    timeoutMs: DOSSIER_TIMEOUT_MS,
  });

  if (outlineOutcome.status === 'rate-limited') return { status: 'rate-limited' };
  if (outlineOutcome.status !== 'ok') return { status: 'unavailable' };

  const outline = coerceOutline(outlineOutcome.json, sources.length);
  if (!outline) {
    console.warn(
      `Dossier outline for ${entity.slug} returned no usable structure (model ${outlineOutcome.model}).`,
    );
    return { status: 'unavailable' };
  }

  // Pass 2: write each section separately so every call stays inside free-tier
  // token limits. One failing section is skipped, not fatal.
  const blocks: DossierBlock[] = [];
  let model = outlineOutcome.model;

  for (const section of outline.sections) {
    const sectionOutcome = await llmJson(
      SECTION_SYSTEM,
      sectionPrompt(entity, section, sources),
      { maxTokens: SECTION_MAX_TOKENS, timeoutMs: DOSSIER_TIMEOUT_MS },
    );

    if (sectionOutcome.status === 'rate-limited') return { status: 'rate-limited' };
    if (sectionOutcome.status !== 'ok') {
      console.warn(
        `Dossier section "${section.heading}" for ${entity.slug} failed (${sectionOutcome.status}).`,
      );
      continue;
    }

    model = sectionOutcome.model;
    const output = coerceSection(sectionOutcome.json, section.citations);
    if (!output) {
      console.warn(
        `Dossier section "${section.heading}" for ${entity.slug} returned no usable prose.`,
      );
      continue;
    }

    blocks.push({ type: 'heading', level: section.level, text: section.heading });
    for (const paragraph of output.paragraphs) {
      blocks.push({ type: 'paragraph', text: paragraph });
    }
    for (const quote of output.quotes) {
      blocks.push({ type: 'quote', text: quote.text, index: quote.index });
    }
  }

  if (blocks.length === 0) return { status: 'unavailable' };

  // Deterministic key facts from the sources' own key points — never invented.
  const keyFacts: KeyFact[] = [];
  for (const [index, source] of sources.entries()) {
    for (const point of source.keyPoints) {
      if (keyFacts.length >= MAX_KEYFACTS) break;
      keyFacts.push({ label: source.source, value: point, index: index + 1 });
    }
    if (keyFacts.length >= MAX_KEYFACTS) break;
  }

  if (keyFacts.length > 0) {
    const insertAt = blocks.findIndex((block) => block.type === 'heading') + 1;
    blocks.splice(insertAt, 0, { type: 'keyfacts', facts: keyFacts });
  }

  const hasHeading = blocks.some((block) => block.type === 'heading');
  const hasProse = blocks.some((block) => block.type === 'paragraph');
  if (!hasHeading || !hasProse) return { status: 'unavailable' };

  const content: DossierContent = { title: outline.title, subtitle: outline.subtitle, blocks };
  return { status: 'ok', content, storyIds: sources.map((source) => source.id), model };
}

/**
 * Upserts a generated dossier. Uses the service role (the generation job), so it
 * bypasses RLS; the public only ever reads.
 */
export async function saveDossier(
  entity: Entity,
  content: DossierContent,
  storyIds: string[],
  model: string,
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  const { error } = await supabase.from('dossiers').upsert(
    {
      slug: entity.slug,
      title: content.title,
      subtitle: content.subtitle,
      blocks: content.blocks as unknown as Json,
      story_ids: storyIds,
      llm_model: model,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'slug' },
  );

  if (error) {
    console.error(`Failed to save dossier ${entity.slug}:`, error);
    return { error: error.message };
  }
  return { error: null };
}
