/**
 * The entity registry.
 *
 * A dossier is a long-form article about one entity, and this is the list of
 * entities we know how to write about. It is deliberately hand-curated rather
 * than derived: a dossier makes claims across many stories, so the subject has
 * to be a real, unambiguous thing (a company or a model family) — not whatever
 * word happens to co-occur most.
 *
 * `terms` are the case-insensitive strings a story is matched on. They are kept
 * narrow on purpose ("gemini", not "google"; "llama", not "meta") so a dossier
 * doesn't silently absorb unrelated stories and then assert things about them.
 */

export type EntityKind = 'vendor' | 'model';

export interface Entity {
  slug: string;
  label: string;
  kind: EntityKind;
  /** One-line description of who/what this entity is, given to the writer. */
  about: string;
  /** Lower-case substrings; a story matches when any of them appears in it. */
  terms: string[];
}

export const ENTITIES: Entity[] = [
  {
    slug: 'anthropic',
    label: 'Anthropic & Claude',
    kind: 'vendor',
    about: 'Anthropic, the AI safety company, and its Claude family of models.',
    terms: ['anthropic', 'claude'],
  },
  {
    slug: 'openai',
    label: 'OpenAI',
    kind: 'vendor',
    about: 'OpenAI and its GPT / ChatGPT products.',
    terms: ['openai', 'chatgpt', 'gpt-4', 'gpt-5', 'gpt-oss'],
  },
  {
    slug: 'google-deepmind',
    label: 'Google DeepMind & Gemini',
    kind: 'vendor',
    about: 'Google DeepMind (and Google AI) and its Gemini family of models.',
    terms: ['deepmind', 'google deepmind', 'gemini', 'google ai studio'],
  },
  {
    slug: 'meta-ai',
    label: 'Meta AI & Llama',
    kind: 'vendor',
    about: 'Meta’s AI efforts and its Llama family of open-weight models.',
    terms: ['meta ai', 'llama', 'meta superintelligence'],
  },
  {
    slug: 'nvidia',
    label: 'NVIDIA',
    kind: 'vendor',
    about: 'NVIDIA, its AI accelerators, and its AI software stack.',
    terms: ['nvidia'],
  },
  {
    slug: 'hugging-face',
    label: 'Hugging Face',
    kind: 'vendor',
    about: 'Hugging Face, the open-model hub and its tooling.',
    terms: ['hugging face', 'huggingface'],
  },
  {
    slug: 'mistral',
    label: 'Mistral AI',
    kind: 'vendor',
    about: 'Mistral AI and its open-weight and commercial models.',
    terms: ['mistral'],
  },
  {
    slug: 'xai',
    label: 'xAI & Grok',
    kind: 'vendor',
    about: 'xAI and its Grok family of models.',
    terms: ['xai', 'grok'],
  },
];

export function findEntity(slug: string): Entity | undefined {
  return ENTITIES.find((entity) => entity.slug === slug);
}

/** Escapes a term so it can be embedded in a PostgREST `or()` filter value. */
export function termPattern(term: string): string {
  return `%${term.replace(/[%_]/g, '')}%`;
}

/**
 * Entities named anywhere in `text`. Used to offer "read the full topic" links
 * from a story page. Matching is substring-based, so it favours the narrow
 * terms in the registry over any cleverness.
 */
export function matchEntities(text: string): Entity[] {
  const haystack = text.toLowerCase();
  return ENTITIES.filter((entity) => entity.terms.some((term) => haystack.includes(term)));
}
