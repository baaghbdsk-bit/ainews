# USY-20 — Scheduled ingest job (auto-update)

**Status:** done (user: "do at last" · free-tier constraint applied)

> **Full analysis:** see [ANALYSIS-hourly-updates.md](ANALYSIS-hourly-updates.md)
> for the scheduler-options comparison, data-flow, cost, safety, and phased plan.
> This file is the short spec; the analysis is the deep-dive.

## Goal
"How will we stay updated with the latest AI records? Create a job / automate it."

## Current state
`fetchAiNews()` runs **on every timeline request** (cached ~5 min). Shallow, not
persisted, and enrichment (USY-19) has nowhere to land.

## Design (decided)
- **Trigger:** GitHub Actions `schedule: cron "0 * * * *"` (free; ~24 run/mo).
  Alternative: self-hosted **n8n**.
- **Ingest route:** `src/app/api/cron/ingest/route.ts`, gated by `CRON_SECRET`.
- **Pipeline (no LLM):** (1) fetch the 6 feeds (reuse `extractItems`/`normalizeItem`);
  (2) dedupe on `source_url` + `(title, event_date)`; (3) insert new items into
  `stories` (`is_published = true`); (4) `revalidatePath('/')` +
  `updateTag('ai-news')`; (5) log `{ fetched, new, existing }`.

## Where the job runs (decided)
- **GitHub Actions** — free, in-repo, 2,000 min/mo. ✅ Recommended.
- **n8n (already installed)** — no-code, self-hosted; machine must stay on.
  Alternative.

## Decisions
- [x] **Scheduler:** GitHub Actions (free); n8n alternative.
- [x] **Frontier:** auto-publish Models/Products/Research → `stories`;
  Policy → `feed_candidates` (editor roles + RLS, USY-11).
- [x] **LLM:** skip for now (USY-18 free heuristic); optional later.

## Files
new `src/app/api/cron/ingest/route.ts`, `.github/workflows/ingest.yml`,
`src/lib/feeds/fetch-ai-news.ts` (refactor to shared), `src/app/page.tsx`.
Optional (USY-19): `supabase/migrations/004_add_article_body.sql`,
`src/lib/supabase/types.ts`, `src/lib/schemas/story.ts`.
