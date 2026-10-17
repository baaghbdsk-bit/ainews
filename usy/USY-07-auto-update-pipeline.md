# USY-07 — Automated ingestion of the latest AI developments

**Status:** done (implemented: `fetchAiNews` + `runIngest` + `/api/cron/ingest` + ingest workflow)

## Goal
"How will we stay updated with the latest AI records? We'll create a job /
automate it — figure it out and let me know."

## What we have today
- `fetchAiNews()` fetches 6 RSS/Atom feeds **on every timeline request**, with a
  ~5-minute `use cache`. It works but: (a) runs in the request path, (b) only
  produces shallow items (title + 1-line summary), (c) newest-first cap starves
  older years (USY-05), (d) nothing is persisted, so enrichment (USY-06) has
  nowhere to land.

## Recommended architecture: a scheduled ingest + enrich job
Split "fetch" from "render": a **cron job** runs on a schedule, pulls feeds,
enriches each new item (LLM article + why-it-matters), and **writes to Supabase**.
The timeline then reads from Supabase (fast, cached, rich) instead of hitting 6
feeds on every page view.

### Pipeline (per run)
1. **Fetch** — pull the 6 feeds (reuse `extractItems`/`normalizeItem` logic).
2. **Dedupe** — by `source_url` and `(title, event_date)` against existing rows.
3. **Enrich** — for each *new* item, call an LLM to write `body` + `significance`
   + `key points` from the feed summary + source (ties to USY-06).
4. **Persist** — insert into Supabase `stories` as `published` (or a `feed_candidates`
   staging table for editorial review).
5. **Revalidate** — `revalidatePath('/')` / `updateTag('ai-news')` so the timeline
   refreshes.

### Where the job runs (options)
- **Vercel Cron** (`vercel.json` `crons` + a `/api/cron/ingest` route, secured by
  a `CRON_SECRET`). Best if deploying on Vercel. Simple, managed.
- **GitHub Actions** scheduled workflow hitting the ingest route — works anywhere,
  no hosting constraint, easy secrets.
- **Supabase Edge Function + pg_cron** — keeps it all in Supabase.
- **n8n** (the machine already has n8n installed) — a no-code scheduled workflow
  that fetches → calls LLM → inserts. Good for a quick start / non-devs.

### Enrichment provider
- Any chat-completions API (OpenAI/Anthropic/Groq/OpenRouter). Needs a key +
  budget. Prompt must instruct: "write 3–5 factual paragraphs from the source
  only; do not invent facts; end with nothing extra."
- To control cost: only enrich items above a relevance bar, batch them, and skip
  re-enrichment of existing slugs.

### Editorial safety (already scaffolded)
The repo already has editor roles + a `feed_candidates` concept (per
`PHASE3_PLAN.md`). Recommend: cron writes to `feed_candidates` (draft), an editor
publishes → moves to `stories`. Or auto-publish Models/Products/Research and
queue Policy for review.

## Plan (pending direction)
1. Create `src/app/api/cron/ingest/route.ts` (GET, guarded by `CRON_SECRET`).
2. Add `vercel.json` cron (e.g. every 30–60 min) OR a GitHub Actions workflow.
3. Add enrichment step (LLM) — needs provider/key decision (USY-06).
4. Point `page.tsx` to read persisted stories (keep a feed fallback).

## Files
new `src/app/api/cron/ingest/route.ts`, `vercel.json` (or `.github/workflows/`),
`src/lib/feeds/fetch-ai-news.ts` (refactor to shared), `src/app/page.tsx`.

## Open decisions
- Cron host: Vercel Cron vs GitHub Actions vs n8n vs Supabase.
- Auto-publish vs editorial review queue.
- LLM provider + key for enrichment.
