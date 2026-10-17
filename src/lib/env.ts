/**
 * Environment accessors with a clear, actionable failure mode.
 *
 * `NEXT_PUBLIC_*` values are read with static property access so Next inlines
 * them into the client bundle. Values that are missing (or left as the
 * placeholders shipped in `.env.local.example`) fail loudly here instead of
 * surfacing as an opaque 401 deep inside a Supabase call.
 */
const PLACEHOLDERS = new Set([
  'your_supabase_project_url',
  'your_supabase_anon_key',
  'your_supabase_service_role_key',
  'change-me',
]);

function requireEnv(value: string | undefined, name: string): string {
  if (!value || PLACEHOLDERS.has(value)) {
    throw new Error(
      `Missing or placeholder environment variable: ${name}. ` +
        'Copy .env.local.example to .env.local and fill in your Supabase credentials.',
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
}

export function supabaseAnonKey(): string {
  return requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export function supabaseServiceRoleKey(): string {
  return requireEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * LLM provider config for the optional summarize tier. Any OpenAI-compatible
 * provider works (Google AI Studio / Gemini, OpenRouter, NVIDIA NIM, Cloudflare
 * Workers AI, Groq, OpenCode Zen, ...).
 *
 * Providers are tried in order: the primary first, then any configured numbered
 * fallbacks (`LLM_FALLBACK_*`, `LLM_FALLBACK2_*`, `LLM_FALLBACK3_*`,
 * `LLM_FALLBACK4_*`). A later provider is only used when every earlier one was
 * rate-limited or unavailable. All are optional: with no key the summarize pass
 * uses the zero-cost extractive summarizer, so the app never hard-depends on a
 * paid/rate-limited provider.
 *
 * `OPENCODE_*` names are still read as a fallback for backwards compatibility.
 */
export interface LlmProvider {
  label: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Optional `reasoning_effort` hint (e.g. "low") for reasoning models. */
  reasoningEffort?: string;
}

function clean(value: string | undefined): string | undefined {
  return value && value.trim() ? value.trim() : undefined;
}

export function llmApiKey(): string | undefined {
  return clean(process.env.LLM_API_KEY ?? process.env.OPENCODE_API_KEY);
}

/** Model id used for the primary LLM provider. */
export function llmModel(): string {
  return clean(process.env.LLM_MODEL ?? process.env.OPENCODE_MODEL) ?? 'gemini-3.5-flash-lite';
}

/** Base URL of the primary OpenAI-compatible API (without a trailing slash). */
export function llmBaseUrl(): string {
  return (
    clean(process.env.LLM_BASE_URL ?? process.env.OPENCODE_BASE_URL) ??
    'https://generativelanguage.googleapis.com/v1beta/openai'
  ).replace(/\/+$/, '');
}

// Ordered fallbacks. The first (`LLM_FALLBACK_*`) defaults to OpenRouter's free
// tier; later slots must specify both a base URL and a model.
const FALLBACK_DEFAULTS = {
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'cohere/north-mini-code:free',
};

/**
 * Ordered list of configured providers: the primary first, then each fallback
 * that has a key. A fallback with a key but no base URL/model is skipped.
 */
export function llmProviders(): LlmProvider[] {
  const providers: LlmProvider[] = [];

  const primaryKey = llmApiKey();
  if (primaryKey) {
    providers.push({
      label: 'primary',
      apiKey: primaryKey,
      baseUrl: llmBaseUrl(),
      model: llmModel(),
      reasoningEffort: clean(process.env.LLM_REASONING_EFFORT),
    });
  }

  const slots = [
    {
      key: clean(process.env.LLM_FALLBACK_API_KEY),
      baseUrl: clean(process.env.LLM_FALLBACK_BASE_URL),
      model: clean(process.env.LLM_FALLBACK_MODEL),
      reasoningEffort: clean(process.env.LLM_FALLBACK_REASONING_EFFORT),
      useDefaults: true,
    },
    {
      key: clean(process.env.LLM_FALLBACK2_API_KEY),
      baseUrl: clean(process.env.LLM_FALLBACK2_BASE_URL),
      model: clean(process.env.LLM_FALLBACK2_MODEL),
      reasoningEffort: clean(process.env.LLM_FALLBACK2_REASONING_EFFORT),
      useDefaults: false,
    },
    {
      key: clean(process.env.LLM_FALLBACK3_API_KEY),
      baseUrl: clean(process.env.LLM_FALLBACK3_BASE_URL),
      model: clean(process.env.LLM_FALLBACK3_MODEL),
      reasoningEffort: clean(process.env.LLM_FALLBACK3_REASONING_EFFORT),
      useDefaults: false,
    },
    {
      key: clean(process.env.LLM_FALLBACK4_API_KEY),
      baseUrl: clean(process.env.LLM_FALLBACK4_BASE_URL),
      model: clean(process.env.LLM_FALLBACK4_MODEL),
      reasoningEffort: clean(process.env.LLM_FALLBACK4_REASONING_EFFORT),
      useDefaults: false,
    },
  ];

  slots.forEach((slot, index) => {
    if (!slot.key) return;
    const label = `fallback${index + 1}`;
    const baseUrl = slot.baseUrl ?? (slot.useDefaults ? FALLBACK_DEFAULTS.baseUrl : undefined);
    const model = slot.model ?? (slot.useDefaults ? FALLBACK_DEFAULTS.model : undefined);
    if (!baseUrl || !model) {
      console.warn(`LLM ${label} has an API key but no base URL/model; skipping.`);
      return;
    }
    providers.push({
      label,
      apiKey: slot.key,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      model,
      reasoningEffort: slot.reasoningEffort,
    });
  });

  return providers;
}
