# signal. — The AI Timeline

A living, chronological index of the breakthroughs, launches, and decisions
moving artificial intelligence forward. Every entry links back to its original
source.

## What it does

The timeline merges three data sources, de-duplicates them, and sorts them
newest-first:

1. **Live RSS/Atom feeds** — six AI news sources fetched (and cached) per
   request, aged out after ~4 years (see `src/lib/feeds/fetch-ai-news.ts`).
2. **Supabase `stories` table** — editorial and ingested rows with `status = 'published'`.
3. **Seed anchors** — curated milestones in `src/app/stories.ts` (2022 → today).

Readers can filter by topic, year, month, and free-text search. Expanding a row
shows an overview; opening `/story/<slug>` shows the full article, "why it
matters", and a link to the original source.

Because the feeds only carry a short excerpt, the ingest job **extracts the real
article** from each story's source URL (a readability pass — no API keys, no
cost) and stores a condensed plain-text body in Supabase. Stories that can't be
extracted fall back to the summary, and fresh headlines that aren't ingested yet
are still rendered from the feed rather than 404ing.

A background ingest job (GitHub Actions → `/api/cron/ingest`) pulls the feeds
into Supabase on a schedule so the archive persists and stays fresh.

The site is **public and read-only**: anyone can browse; nothing in the UI can be
edited. Only accounts whose `app_metadata.role` is `editor` may write, and no
editor accounts exist by default (see `supabase/migrations/004_editor_only_writes.sql`).

## Stack

- Next.js 16 (App Router, Turbopack, `cacheComponents`) + React 19
- TypeScript (strict)
- Supabase (Postgres + RLS) via `@supabase/ssr`
- Tailwind CSS v4 + a hand-authored design system in `src/app/globals.css`
- `zod` for validation, `fast-xml-parser` for feeds, `lucide-react` for icons

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000. See [`QUICK_START.md`](./QUICK_START.md) for the full
Supabase setup walkthrough.

## Scripts

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the dev server (Turbopack)     |
| `npm run build`     | Production build                     |
| `npm run start`     | Serve the production build           |
| `npm run lint`      | ESLint                               |
| `npm run typecheck` | TypeScript, no emit                  |
| `npm run db:migrate`| Apply pending SQL migrations         |

## Project layout

```
src/
  app/
    page.tsx                 # Timeline (merges feeds + DB + seed)
    explore-client.tsx       # Interactive timeline (filters, search, infinite scroll)
    story/[storyId]/page.tsx # Story detail (Supabase, then seed fallback)
    api/cron/ingest/route.ts # Bearer-protected ingest trigger
    stories.ts               # Curated seed milestones
  lib/
    actions/stories.ts       # Cached reads + editor server actions
    feeds/                   # RSS fetch/normalize, ingest persistence, article extraction
    schemas/story.ts         # Zod schemas + Story type
    supabase/                # browser / server / cookie-free clients + types
    slug.ts                  # Shared slug + URL canonicalization
    env.ts                   # Env accessors with clear errors
supabase/migrations/         # 001 schema · 002 RLS · 003 seed · 004 editor-only writes · 005 article body · 006 search_path
usy/                         # Build-in-public notes for each unit of work
```

## Database migrations

SQL files in `supabase/migrations/` are applied by `scripts/migrate.mjs`, which
records each file in `public.schema_migrations` so re-runs are no-ops (each file
runs in a transaction).

- **Locally:** put `DATABASE_URL` in `.env.local`, then `npm run db:migrate`.
- **Automatically:** add `DATABASE_URL` as a repository secret; the
  `.github/workflows/migrate.yml` workflow applies new migrations on push to
  `main` (and on manual dispatch). No more copying SQL into the dashboard.

## Environment variables

| Variable                        | Scope   | Purpose                                        |
| ------------------------------- | ------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | public  | Supabase project URL                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public  | RLS-protected public key                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | secret  | Ingest job only (bypasses RLS)                 |
| `CRON_SECRET`                   | secret  | Bearer token checked by `/api/cron/ingest`     |
| `INGEST_ENRICH_LIMIT`           | secret  | Optional: articles extracted per ingest run    |
| `INGEST_SUMMARIZE_LIMIT`        | secret  | Optional: summaries generated per ingest run   |
| `INGEST_SUMMARIZE_GAP_MS`       | secret  | Optional: ms between LLM calls (default 4500)  |
| `LLM_API_KEY`                   | secret  | Optional: LLM summaries (any OpenAI-compat API)|
| `LLM_MODEL`                     | secret  | Optional: model id (default gemini-3.5-flash-lite)|
| `LLM_BASE_URL`                  | secret  | Optional: API base URL (default Gemini)        |
| `LLM_FALLBACK_API_KEY`          | secret  | Optional: fallback 1 key (e.g. OpenRouter)     |
| `LLM_FALLBACK_MODEL`            | secret  | Optional: fallback 1 model id                  |
| `LLM_FALLBACK_BASE_URL`         | secret  | Optional: fallback 1 API base URL              |
| `LLM_FALLBACK2_*`               | secret  | Optional: fallback 2 key/model/base (NVIDIA…)  |
| `LLM_FALLBACK3_*`               | secret  | Optional: fallback 3 key/model/base (Cloudflare)|
| `LLM_FALLBACK4_*`               | secret  | Optional: fallback 4 key/model/base            |
| `LLM_*_REASONING_EFFORT`        | secret  | Optional: reasoning-effort hint (e.g. `low`)   |
| `DATABASE_URL`                  | secret  | Migrations only (`npm run db:migrate` / CI)    |

The GitHub Actions ingest workflow additionally needs `INGEST_URL` (the deployed
app URL) as a repository secret.

## Background ingest

`.github/workflows/ingest.yml` runs every 30 minutes and calls
`GET /api/cron/ingest` with `Authorization: Bearer $CRON_SECRET`. Requires
`CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`INGEST_URL` to be set as repository secrets.

Each run fetches the feeds, extracts article bodies (`?mode=enrich` drains the
backlog), and generates a reader-facing summary per story (`?mode=summarize`):
a deck, key points, a "why it matters" line, and a professional brief. With
`LLM_API_KEY` set (in the deployment env) these are written by a grounded LLM
(any OpenAI-compatible API, e.g. Gemini or Groq); without it, a zero-cost
extractive fallback fills the deck and rows are upgraded automatically once a
key is added. Up to four `LLM_FALLBACK*_*` providers (OpenRouter, NVIDIA NIM,
Cloudflare Workers AI, ...) are tried in order whenever the earlier providers
are rate-limited or unavailable.
