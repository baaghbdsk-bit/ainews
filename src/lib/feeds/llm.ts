import { llmProviders, type LlmProvider } from '@/lib/env';

/**
 * Thin client for one or more OpenAI-compatible chat APIs (Google AI Studio /
 * Gemini, OpenRouter, Groq, OpenCode Zen, ...).
 *
 * Used by the ingest job's summarize pass to turn an extracted article into a
 * reader-facing deck, key points, and a short brief. Providers are tried in
 * order (primary, then any configured fallbacks), so a throttled or unavailable
 * primary transparently fails over. It is strictly optional: with no API key
 * configured the pass falls back to the extractive summarizer, so the site never
 * breaks if a key is missing, exhausted, or throttled.
 *
 * Failure handling is deliberately layered, because a single cron pass makes
 * dozens of calls back-to-back and one sick provider must not stall it:
 *   * transient failures (5xx, network error, junk response) are retried once
 *     per provider with a short backoff;
 *   * a rate limit (429) or a timeout puts that provider on a cooldown so the
 *     rest of the pass skips it instead of re-hammering it on every row;
 *   * a 4xx other than 429 (bad key, unknown model, malformed request) is
 *     permanent for that provider, so we fail over immediately without wasting
 *     attempts;
 *   * `Retry-After` is honoured when the provider sends it.
 *
 * Outcomes mirror the article extractor: `rate-limited` (HTTP 429, or every
 * provider on cooldown) is distinct from `unavailable` so a throttled row can be
 * retried later rather than being counted as a permanent failure.
 */

export type LlmOutcome =
  | { status: 'ok'; json: unknown; model: string }
  | { status: 'rate-limited'; retryAfterMs?: number }
  | { status: 'unavailable' }
  | { status: 'disabled' };

// Summaries are small, but free tiers can be slow under load.
const REQUEST_TIMEOUT_MS = 60000;
// Bound output so a chatty/thinking model can't run away on cost.
const MAX_OUTPUT_TOKENS = 1600;

// One retry per provider for transient failures. A timeout is never retried: it
// already burned the whole timeout budget, so a second attempt would just stall
// again.
const MAX_ATTEMPTS_PER_PROVIDER = 2;
const RETRY_BASE_DELAY_MS = 750;
const MAX_RETRY_DELAY_MS = 8000;

// How long a provider is skipped after it throttles us (or times out). Keeps a
// throttled provider from eating a call on every row of the pass.
const RATE_LIMIT_COOLDOWN_MS = 60000;
const TIMEOUT_COOLDOWN_MS = 30000;
const MAX_COOLDOWN_MS = 5 * 60 * 1000;

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

// Cooldown state is per-process. On serverless it only spans one invocation,
// which is exactly where it matters (one summarize pass = many calls).
const cooldowns = new Map<string, number>();

function providerKey(provider: LlmProvider): string {
  return `${provider.baseUrl}|${provider.model}`;
}

function cooldownRemaining(provider: LlmProvider): number {
  const until = cooldowns.get(providerKey(provider));
  return until && until > Date.now() ? until - Date.now() : 0;
}

function setCooldown(provider: LlmProvider, ms: number): void {
  const bounded = Math.min(Math.max(ms, 0), MAX_COOLDOWN_MS);
  cooldowns.set(providerKey(provider), Date.now() + bounded);
}

/** Clears every provider cooldown (used by tests and long-lived processes). */
export function resetLlmCooldowns(): void {
  cooldowns.clear();
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
  let retryAfterMs: number | undefined;
  const tried = new Set<string>();

  for (const provider of providers) {
    const key = providerKey(provider);
    // Two slots pointing at the same endpoint+model would each burn a full
    // retry cycle for the same failure.
    if (tried.has(key)) continue;
    tried.add(key);

    const cooling = cooldownRemaining(provider);
    if (cooling > 0) {
      sawRateLimit = true;
      retryAfterMs = Math.max(retryAfterMs ?? 0, cooling);
      continue;
    }

    const outcome = await callProvider(provider, system, user, options);
    if (outcome.status === 'ok') return outcome;
    if (outcome.status === 'rate-limited') {
      sawRateLimit = true;
      retryAfterMs = Math.max(retryAfterMs ?? 0, outcome.retryAfterMs ?? RATE_LIMIT_COOLDOWN_MS);
    }
  }

  // If any provider was merely throttled (or cooling down), report that so the
  // row is retried rather than treated as a hard failure.
  return sawRateLimit
    ? { status: 'rate-limited', ...(retryAfterMs ? { retryAfterMs } : {}) }
    : { status: 'unavailable' };
}

/** Why one provider attempt ended. Internal to the failover loop. */
type Attempt =
  | { kind: 'ok'; json: unknown }
  | { kind: 'rate-limited'; retryAfterMs?: number }
  | { kind: 'timeout' }
  | { kind: 'transient'; detail: string }
  | { kind: 'permanent'; detail: string };

async function callProvider(
  provider: LlmProvider,
  system: string,
  user: string,
  options: LlmCallOptions,
): Promise<LlmOutcome> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROVIDER; attempt++) {
    const result = await callProviderOnce(provider, system, user, timeoutMs, options);

    switch (result.kind) {
      case 'ok':
        return { status: 'ok', json: result.json, model: provider.model };

      case 'rate-limited': {
        const wait = result.retryAfterMs ?? RATE_LIMIT_COOLDOWN_MS;
        setCooldown(provider, wait);
        console.warn(
          `LLM ${provider.label} (${provider.model}) is rate-limited; skipping it for ${Math.round(wait / 1000)}s.`,
        );
        return { status: 'rate-limited', retryAfterMs: wait };
      }

      // A 4xx other than 429 means the request itself is wrong (bad key,
      // unknown model, unsupported parameter): retrying changes nothing.
      case 'permanent':
        console.warn(`LLM ${provider.label} (${provider.model}) rejected the request: ${result.detail}`);
        return { status: 'unavailable' };

      case 'timeout':
        setCooldown(provider, TIMEOUT_COOLDOWN_MS);
        console.warn(
          `LLM ${provider.label} (${provider.model}) timed out after ${timeoutMs}ms; skipping it for ${Math.round(TIMEOUT_COOLDOWN_MS / 1000)}s.`,
        );
        return { status: 'unavailable' };

      case 'transient':
        if (attempt < MAX_ATTEMPTS_PER_PROVIDER) {
          const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
          console.warn(
            `LLM ${provider.label} (${provider.model}) ${result.detail}; retrying in ${delay}ms.`,
          );
          await sleep(delay);
          continue;
        }
        console.warn(
          `LLM ${provider.label} (${provider.model}) ${result.detail}; giving up after ${MAX_ATTEMPTS_PER_PROVIDER} attempts.`,
        );
        return { status: 'unavailable' };
    }
  }

  return { status: 'unavailable' };
}

async function callProviderOnce(
  provider: LlmProvider,
  system: string,
  user: string,
  timeoutMs: number,
  options: LlmCallOptions,
): Promise<Attempt> {
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

    if (res.status === 429) {
      return { kind: 'rate-limited', retryAfterMs: parseRetryAfter(res.headers.get('retry-after')) };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const detail = `HTTP ${res.status} ${body.slice(0, 160)}`;
      return res.status >= 500 ? { kind: 'transient', detail } : { kind: 'permanent', detail };
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return { kind: 'transient', detail: 'returned an empty response' };
    }

    const json = parseJsonLoose(content);
    return json === null ? { kind: 'transient', detail: 'returned unparseable JSON' } : { kind: 'ok', json };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return { kind: 'timeout' };
    return {
      kind: 'transient',
      detail: `request failed (${err instanceof Error ? err.message : String(err)})`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Parses `Retry-After` (delta seconds or an HTTP date), bounded to the cooldown cap. */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_COOLDOWN_MS);
  }
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), MAX_COOLDOWN_MS);
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
