import { llmProviders, type LlmProvider } from '@/lib/env';

/**
 * Thin client for one or more OpenAI-compatible chat APIs (Google AI Studio /
 * Gemini, OpenRouter, Groq, OpenCode Zen, ...).
 *
 * Used by the ingest job's summarize pass to turn an extracted article into a
 * reader-facing deck, key points, and a short brief. Providers are tried in
 * order (primary, then an optional fallback), so a throttled or unavailable
 * primary transparently fails over. It is strictly optional: with no API key
 * configured the pass falls back to the extractive summarizer, so the site never
 * breaks if a key is missing, exhausted, or throttled.
 *
 * Outcomes mirror the article extractor: `rate-limited` (HTTP 429) is distinct
 * from `unavailable` so a throttled row can be retried later rather than being
 * counted as a permanent failure.
 */

export type LlmOutcome =
  | { status: 'ok'; json: unknown; model: string }
  | { status: 'rate-limited' }
  | { status: 'unavailable' }
  | { status: 'disabled' };

// Summaries are small, but free tiers can be slow under load.
const REQUEST_TIMEOUT_MS = 60000;
// Bound output so a chatty/thinking model can't run away on cost.
const MAX_OUTPUT_TOKENS = 1600;

export interface LlmCallOptions {
  /** Upper bound on output tokens (defaults to a summary-sized budget). */
  maxTokens?: number;
  /** Sampling temperature (defaults to 0.2 — factual). */
  temperature?: number;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

/** True when at least one LLM provider is configured. */
export function llmEnabled(): boolean {
  return llmProviders().length > 0;
}

/**
 * Asks the first provider that responds for a JSON object. Returns the parsed
 * JSON (and the model that produced it), or a status describing why it couldn't
 * be produced. Never throws.
 */
export async function llmJson(
  system: string,
  user: string,
  options: LlmCallOptions = {},
): Promise<LlmOutcome> {
  const providers = llmProviders();
  if (providers.length === 0) return { status: 'disabled' };

  let sawRateLimit = false;
  for (const provider of providers) {
    const outcome = await callProvider(provider, system, user, options);
    if (outcome.status === 'ok') return outcome;
    if (outcome.status === 'rate-limited') sawRateLimit = true;
  }
  // If any provider was merely throttled, report that so the row is retried
  // rather than treated as a hard failure.
  return sawRateLimit ? { status: 'rate-limited' } : { status: 'unavailable' };
}

async function callProvider(
  provider: LlmProvider,
  system: string,
  user: string,
  options: LlmCallOptions,
): Promise<LlmOutcome> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
        ...(provider.reasoningEffort ? { reasoning_effort: provider.reasoningEffort } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (res.status === 429) return { status: 'rate-limited' };
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(
        `LLM ${provider.label} (${provider.model}) failed: HTTP ${res.status} ${body.slice(0, 200)}`,
      );
      return { status: 'unavailable' };
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) return { status: 'unavailable' };

    const json = parseJsonLoose(content);
    return json === null ? { status: 'unavailable' } : { status: 'ok', json, model: provider.model };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn(`LLM ${provider.label} (${provider.model}) timed out after ${timeoutMs}ms`);
    }
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

/** Tolerates models that wrap JSON in prose or a ```json fence. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
