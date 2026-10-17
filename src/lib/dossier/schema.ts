import { z } from 'zod';

/**
 * The dossier content model.
 *
 * A dossier is stored and rendered as an ordered list of typed blocks rather
 * than one HTML/Markdown string. That keeps the renderer in full control — it
 * never injects third-party HTML — and lets each block type cite its own
 * sources instead of hoping the prose happens to mention them.
 *
 * Citation markers are 1-based indexes into the dossier's `story_ids` array,
 * written inline as `[3]`. Anything outside that range is stripped before the
 * content is stored, so the renderer can never link a marker to a story that
 * wasn't actually supplied.
 */

const MAX_HEADING_CHARS = 90;
const MAX_PARAGRAPH_CHARS = 900;
const MAX_LIST_ITEM_CHARS = 200;
const MAX_LIST_ITEMS = 8;
const MAX_QUOTE_CHARS = 500;
export const MAX_KEYFACTS = 8;const MAX_BLOCKS = 60;

export interface HeadingBlock {
  type: 'heading';
  level: 2 | 3;
  text: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface ListBlock {
  type: 'list';
  items: string[];
}

export interface QuoteBlock {
  type: 'quote';
  text: string;
  /** 1-based index into `story_ids`; the quote is attributed to that story. */
  index: number;
}

export interface KeyFact {
  label: string;
  value: string;
  /** 1-based index into `story_ids`, when the fact came from one story. */
  index?: number;
}

export interface KeyFactsBlock {
  type: 'keyfacts';
  facts: KeyFact[];
}

export type DossierBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | QuoteBlock
  | KeyFactsBlock;

export interface DossierContent {
  title: string;
  subtitle: string;
  blocks: DossierBlock[];
}

// --- Read-side validation ---------------------------------------------------

export const DossierBlockSchema: z.ZodType<DossierBlock> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heading'),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string().min(1),
  }),
  z.object({ type: z.literal('paragraph'), text: z.string().min(1) }),
  z.object({ type: z.literal('list'), items: z.array(z.string().min(1)).min(1) }),
  z.object({
    type: z.literal('quote'),
    text: z.string().min(1),
    index: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('keyfacts'),
    facts: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.string().min(1),
          index: z.number().int().min(1).optional(),
        }),
      )
      .min(1),
  }),
]);

export const DossierBlocksSchema = z.array(DossierBlockSchema);

// --- Citation helpers -------------------------------------------------------

const CITATION = /\[(\d{1,3})\]/g;

/** 1-based story indexes referenced by inline `[n]` markers, in first-use order. */
export function citationIndices(text: string): number[] {
  const seen: number[] = [];
  for (const match of text.matchAll(CITATION)) {
    const index = Number(match[1]);
    if (!seen.includes(index)) seen.push(index);
  }
  return seen;
}

/**
 * Removes `[n]` markers that point outside the supplied sources (models like to
 * invent `[1]` when handed no list, or over-count). Valid markers are kept so
 * the renderer can turn them into links.
 */
export function stripInvalidCitations(text: string, sourceCount: number): string {
  return text.replace(CITATION, (marker, digits: string) => {
    const index = Number(digits);
    return index >= 1 && index <= sourceCount ? marker : '';
  });
}

// --- Write-side coercion ----------------------------------------------------

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function asTrimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = normalize(value);
  if (!text) return null;
  return text.length > max ? text.slice(0, max).trim() : text;
}

function asIndex(value: unknown, sourceCount: number): number | null {
  const index = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(index) || index < 1 || index > sourceCount) return null;
  return index;
}

/**
 * Turns whatever the model returned into typed, bounded blocks — or `null` when
 * there isn't enough usable structure to render an article. Tolerant by design:
 * an unusable block is dropped rather than failing the whole generation, but a
 * dossier with no heading or no prose is rejected outright.
 */
export function coerceDossier(raw: unknown, sourceCount: number): DossierContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const title = asTrimmed(obj.title, MAX_HEADING_CHARS);
  const subtitle = asTrimmed(obj.subtitle, MAX_PARAGRAPH_CHARS);
  if (!title || !subtitle) return null;
  if (!Array.isArray(obj.blocks)) return null;

  const blocks: DossierBlock[] = [];

  for (const entry of obj.blocks) {
    if (blocks.length >= MAX_BLOCKS) break;
    if (!entry || typeof entry !== 'object') continue;
    const block = entry as Record<string, unknown>;

    switch (block.type) {
      case 'heading': {
        const text = asTrimmed(block.text, MAX_HEADING_CHARS);
        if (!text) break;
        const level = block.level === 3 ? 3 : 2;
        blocks.push({ type: 'heading', level, text });
        break;
      }
      case 'paragraph': {
        const text = asTrimmed(block.text, MAX_PARAGRAPH_CHARS);
        if (!text) break;
        blocks.push({ type: 'paragraph', text: stripInvalidCitations(text, sourceCount) });
        break;
      }
      case 'list': {
        if (!Array.isArray(block.items)) break;
        const items = block.items
          .map((item) => asTrimmed(item, MAX_LIST_ITEM_CHARS))
          .filter((item): item is string => item !== null)
          .map((item) => stripInvalidCitations(item, sourceCount))
          .slice(0, MAX_LIST_ITEMS);
        if (items.length) blocks.push({ type: 'list', items });
        break;
      }
      case 'quote': {
        const text = asTrimmed(block.text, MAX_QUOTE_CHARS);
        const index = asIndex(block.index, sourceCount);
        if (!text || index === null) break;
        blocks.push({ type: 'quote', text, index });
        break;
      }
      case 'keyfacts': {
        if (!Array.isArray(block.facts)) break;
        const facts: KeyFact[] = [];
        for (const fact of block.facts) {
          if (facts.length >= MAX_KEYFACTS) break;
          if (!fact || typeof fact !== 'object') continue;
          const entry = fact as Record<string, unknown>;
          const label = asTrimmed(entry.label, MAX_HEADING_CHARS);
          const value = asTrimmed(entry.value, MAX_LIST_ITEM_CHARS);
          if (!label || !value) continue;
          const index = asIndex(entry.index, sourceCount) ?? undefined;
          facts.push({ label, value, ...(index ? { index } : {}) });
        }
        if (facts.length) blocks.push({ type: 'keyfacts', facts });
        break;
      }
      default:
        break;
    }
  }

  const hasHeading = blocks.some((block) => block.type === 'heading');
  const hasProse = blocks.some((block) => block.type === 'paragraph');
  if (!hasHeading || !hasProse) return null;

  return { title, subtitle, blocks };
}

/** Every 1-based source index the content actually cites, in traversal order. */
export function citedIndices(blocks: DossierBlock[]): number[] {
  const used: number[] = [];
  const add = (index: number) => {
    if (!used.includes(index)) used.push(index);
  };
  for (const block of blocks) {
    if (block.type === 'paragraph' || block.type === 'list') {
      const text = block.type === 'paragraph' ? block.text : block.items.join(' ');
      citationIndices(text).forEach(add);
    } else if (block.type === 'quote') {
      add(block.index);
    } else if (block.type === 'keyfacts') {
      for (const fact of block.facts) if (fact.index) add(fact.index);
    }
  }
  return used;
}

// --- Outline (pass 1) and section writing (pass 2) --------------------------

export interface SectionPlan {
  heading: string;
  level: 2 | 3;
  /** 1-based indexes into `story_ids` that this section may cite. */
  citations: number[];
  /** One-sentence plan for what this section covers. */
  plan: string;
}

export interface SectionQuote {
  text: string;
  index: number;
}

export interface SectionOutput {
  paragraphs: string[]; // prose with [n] citations
  quotes: SectionQuote[];
}

export interface Outline {
  title: string;
  subtitle: string;
  sections: SectionPlan[];
}

const MAX_OUTLINE_SECTIONS = 10;
const MIN_OUTLINE_SECTIONS = 3;
const MAX_SECTION_PLAN_CHARS = 200;
const MAX_SECTION_PARAGRAPH_CHARS = 500;
const MAX_SECTION_QUOTE_CHARS = 500;
const MIN_SECTION_PARAGRAPHS = 1;

/** Keeps only `[n]` markers whose index is in `allowed`; drops the rest. */
export function keepCitations(text: string, allowed: number[]): string {
  return text.replace(CITATION, (marker, digits: string) => {
    const index = Number(digits);
    return allowed.includes(index) ? marker : '';
  });
}

/** Turns the model's outline into validated, bounded plans. */
export function coerceOutline(raw: unknown, sourceCount: number): Outline | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const title = asTrimmed(obj.title, MAX_HEADING_CHARS);
  const subtitle = asTrimmed(obj.subtitle, MAX_PARAGRAPH_CHARS);
  if (!title || !subtitle) return null;
  if (!Array.isArray(obj.sections)) return null;

  const sections: SectionPlan[] = [];
  const seenHeadings = new Set<string>();

  for (const entry of obj.sections) {
    if (sections.length >= MAX_OUTLINE_SECTIONS) break;
    if (!entry || typeof entry !== 'object') continue;
    const block = entry as Record<string, unknown>;

    const heading = asTrimmed(block.heading, MAX_HEADING_CHARS);
    if (!heading || seenHeadings.has(heading.toLowerCase())) continue;
    seenHeadings.add(heading.toLowerCase());

    const level = block.level === 3 ? 3 : 2;
    const rawCitations = Array.isArray(block.citations)
      ? block.citations
      : [];
    const citations: number[] = [];
    for (const c of rawCitations) {
      const index = typeof c === 'number' ? c : Number(c);
      if (Number.isInteger(index) && index >= 1 && index <= sourceCount && !citations.includes(index)) {
        citations.push(index);
      }
    }
    if (citations.length === 0) continue; // a section must cite something to be grounded

    const plan = (asTrimmed(block.plan, MAX_SECTION_PLAN_CHARS) ?? '');
    sections.push({ heading, level, citations, plan });
  }

  if (sections.length < MIN_OUTLINE_SECTIONS) return null;

  return { title, subtitle, sections };
}

/** Turns the model's section draft into validated prose + quotes. */
export function coerceSection(
  raw: unknown,
  allowedIndices: number[],
): SectionOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.paragraphs)) return null;
  const paragraphs: string[] = [];
  for (const p of obj.paragraphs) {
    if (paragraphs.length >= MAX_BLOCKS) break;
    const text = asTrimmed(p, MAX_SECTION_PARAGRAPH_CHARS);
    if (!text) continue;
    paragraphs.push(keepCitations(text, allowedIndices));
  }
  if (paragraphs.length < MIN_SECTION_PARAGRAPHS) return null;

  const quotes: SectionQuote[] = [];
  if (Array.isArray(obj.quotes)) {
    for (const q of obj.quotes) {
      if (quotes.length >= MAX_KEYFACTS) break;
      if (!q || typeof q !== 'object') continue;
      const entry = q as Record<string, unknown>;
      const text = asTrimmed(entry.text, MAX_SECTION_QUOTE_CHARS);
      const index = asIndex(entry.index, sourceCountForQuotes(allowedIndices));
      if (!text || index === null || !allowedIndices.includes(index)) continue;
      quotes.push({ text, index });
    }
  }

  return { paragraphs, quotes };
}

// `asIndex` needs a source count; section writing is scoped to its own sources.
function sourceCountForQuotes(allowedIndices: number[]): number {
  return Math.max(...allowedIndices);
}

/** Every source index the outline actually cites, deduplicated. */
export function outlineCitedIndices(outline: Outline): number[] {
  const used: number[] = [];
  for (const section of outline.sections) {
    for (const index of section.citations) if (!used.includes(index)) used.push(index);
  }
  return used;
}
