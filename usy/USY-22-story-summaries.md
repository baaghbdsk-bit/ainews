# USY-22 — Story summaries (LLM tier + extractive fallback)

**Status:** done (both tiers live; LLM tier runs on Gemini `gemini-3.5-flash-lite`)

## Goal
Make the timeline's expanded row give a reader the full context without leaving
the page, and give the story page a professional, readable article — "like a
professional platform". User: "one should get the context from summary".

## Two-tier design
- **LLM tier (optional):** any OpenAI-compatible API (`LLM_API_KEY` +
  `LLM_MODEL` + `LLM_BASE_URL`; currently Google AI Studio / Gemini), with up to
  four ordered fallbacks (`LLM_FALLBACK_*`, `LLM_FALLBACK2_*`, ...; currently
  OpenRouter, NVIDIA NIM) tried when earlier providers are rate-limited or
  unavailable. Sends the headline, feed excerpt, and extracted
  body to the model with a grounded prompt ("use only facts in the text; never
  invent") and asks for strict JSON:
  `{ deck, keyPoints[], whyItMatters, brief }`.
- **Extractive fallback (zero cost):** the lexical summarizer in `summarize.ts`
  (`buildDeck`) fills `deck` from the publisher description + top sentences.

The pass is **provider-optional and self-upgrading**: with no key it writes an
extractive deck; once a key exists, the same queue (`deck IS NULL OR
llm_model IS NULL`, bounded by `summary_attempts`) re-visits those rows and
replaces them with LLM output. A throttled provider (HTTP 429) leaves the row
untouched so it can be retried, exactly like the article extractor.

## Data (migration 007)
`deck`, `key_points TEXT[]`, `why_it_matters`, `brief`, `llm_model`,
`llm_generated_at`, `summary_attempts` on `stories`, plus a partial index on the
summarize queue.

## Where it runs
- Ingest job (`runIngest`): a summarize pass after enrichment; `?mode=summarize`
  drains the backlog; `INGEST_SUMMARIZE_LIMIT` bounds each run.
- UI: the expanded timeline row shows the deck + key points; the story page shows
  the deck as a standfirst, the brief (else the extracted body), and key points.

## Coverage (this project)
891 published stories summarized with the extractive tier (no key yet); ~861
also have an extracted body. Rows are queued for an automatic LLM upgrade.

## Files
- `src/lib/feeds/summarize.ts` — `buildDeck` (extractive) + `summarizeArticle`
- `src/lib/feeds/llm.ts` — OpenAI-compatible chat client with provider fallback
- `src/lib/feeds/ingest.ts` — `summarizeStories` pass (paced by `INGEST_SUMMARIZE_GAP_MS`)
- `src/lib/env.ts` — `llmApiKey` / `llmModel` / `llmBaseUrl` + `llmProviders`
- `supabase/migrations/007_add_story_summaries.sql`
- `src/app/page.tsx`, `src/app/explore-client.tsx`, `src/app/story/[storyId]/page.tsx`
- `src/app/api/cron/ingest/route.ts` (`?mode=summarize`)
- `src/lib/schemas/story.ts`, `src/lib/supabase/types.ts`, `src/app/globals.css`
