/**
 * Company / organisation extraction for timeline stories.
 *
 * Ingested stories from RSS feeds rarely carry a structured `company` field, so
 * we derive one by matching known AI companies / organisations against the
 * story's title, summary, body and source. The list is deliberately broad but
 * not exhaustive — it covers the organisations that actually appear in our
 * feeds (Anthropic, OpenAI, Google, DeepSeek, NVIDIA, European Commission,
 * Council of the European Union, AWS, Mistral, Cohere, …).
 *
 * Matches are whole-word, case-insensitive, and longer names win (so "Google
 * DeepMind" beats "Google"). Returns `undefined` when nothing matches, so
 * callers can fall back gracefully.
 */

const COMPANY_LIST = [
  // Frontier labs
  'Anthropic',
  'OpenAI',
  'Google DeepMind',
  'DeepMind',
  'xAI',
  'Meta',
  'Microsoft',
  'NVIDIA',
  'Amazon',
  'AWS',
  'Apple',
  'Cohere',
  'Mistral AI',
  'Mistral',
  'Hugging Face',
  'Perplexity AI',
  'Perplexity',
  'Stability AI',
  'Character AI',
  'Inflection AI',
  'Adept',
  'Replit',
  'Scale AI',
  'Groq',
  'Cerebras',
  'SambaNova',
  'Together AI',
  'Fireworks AI',
  'Anyscale',
  'Databricks',
  'Snowflake',
  'Palantir',
  // Regulators / public bodies
  'European Commission',
  'Council of the European Union',
  'European Parliament',
  'U.S. Department of Commerce',
  'Bureau of Industry and Security',
  'UK AI Safety Institute',
  'AISI',
  // News / research outlets (kept as sources only when they appear as a company)
  'TechCrunch',
  'MIT Technology Review',
  'The Verge',
  'Wired',
  'Ars Technica',
  'VentureBeat',
  'The Batch',
  'Import AI',
].sort((a, b) => b.length - a.length);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COMPANY_PATTERNS = COMPANY_LIST.map((name) => ({
  name,
  re: new RegExp(`\\b${escapeRegExp(name.toLowerCase())}\\b`),
}));

/**
 * Returns the best-matching company/organisation for a story, or `undefined`.
 * Longer names are checked first so "Google DeepMind" is preferred over "Google".
 */
export function extractCompany(input: {
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  source?: string | null;
}): string | undefined {
  const haystack = [
    input.title ?? '',
    input.summary ?? '',
    input.body ?? '',
    input.source ?? '',
  ]
    .join(' ')
    .toLowerCase();

  for (const { name, re } of COMPANY_PATTERNS) {
    if (re.test(haystack)) return name;
  }
  return undefined;
}
