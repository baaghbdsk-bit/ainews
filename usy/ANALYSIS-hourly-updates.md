# Analysis — Keeping signal. updated every hour

**Goal:** the timeline should reflect the latest AI developments automatically,
refreshing about **once an hour**, with no manual step.

This is the deep-dive behind [USY-20](USY-20-scheduled-ingest-job.md) and the
enrichment half of [USY-19](USY-19-full-article-pages.md). It lays out the moving
parts, the options for *where the job runs*, the data-flow, cost, safety, and a
concrete recommendation.

> **Decision (free-first):** the app is pre-growth, so we run the whole pipeline
> on **free tiers only** — **GitHub Actions** (or self-hosted **n8n**) for the
> hourly trigger, **Supabase free tier** for storage, and **no paid LLM** (we keep
> the zero-cost heuristic enrichment from USY-18). Vercel Cron is out on the free
> Hobby plan (daily only). See §11.

---

## 1. The problem with "update on page view" (today)

`fetchAiNews()` currently runs **inside the timeline request**, wrapped in
`'use cache'` with `cacheLife('minutes')`. Consequences:

- **Latency risk on cold cache** — after the cache expires, the first visitor
  waits on 6 upstream feeds (each with a 3s timeout) before the page streams.
- **No persistence** — nothing is stored, so:
  - enrichment (LLM articles, better summaries) has nowhere to land,
  - we can't dedupe against history across restarts,
  - editorial review has no staging area.
- **Thin data** — only title + one description line; no article body.
- **Freshness is accidental** — it updates whenever someone visits after expiry,
  not on a schedule.

**Conclusion:** split *ingestion* (scheduled, writes to DB) from *rendering*
(reads DB, always fast). This is the standard "pull on a cron, serve from cache"
pattern.

---

## 2. Target architecture

```
        every ~60 min
   ┌──────────────────────────┐
   │  INGEST JOB (cron)       │
   │  1. fetch 6 RSS feeds    │
   │  2. normalize + dedupe   │   by source_url + (title, event_date)
   │  3. enrich new items     │   (optional LLM: body + why-it-matters)
   │  4. write to Supabase    │   stories (published) or feed_candidates (review)
   │  5. revalidate "/"       │   updateTag('ai-news') / revalidatePath('/')
   └────────────┬─────────────┘
                │
                ▼
        ┌───────────────┐        ┌────────────────────┐
        │   Supabase     │───────▶│  Timeline "/"       │
        │   stories      │  read  │  (reads DB, cached) │
        └───────────────┘        └────────────────────┘
```

The timeline stops calling feeds directly; it reads `getPublishedStories()`
(already exists, USY-12) and keeps the direct-feed path only as a fallback.

---

## 3. Where the hourly job runs — options compared

| Option | How | Pros | Cons | Best when |
|---|---|---|---|---|
| **Vercel Cron** | `vercel.json` `crons` → hits `/api/cron/ingest`, guarded by `CRON_SECRET` | Managed, zero infra, same deploy, secrets in env | Only on Vercel; Hobby plan limits cron to **once/day** (Pro needed for hourly) | Deploying on Vercel with a Pro plan |
| **GitHub Actions** | Scheduled workflow (`on: schedule: cron '0 * * * *'`) `curl`s the ingest route | Host-agnostic, free minutes, secrets in GH, easy logs | Needs a public URL for the route; GH cron can lag a few min under load | Any host; want it "in the repo" |
| **Supabase Edge Function + pg_cron** | `pg_cron` calls `pg_net` → Edge Function that fetches+inserts | All-in-Supabase, runs next to the DB, no extra host | More setup; Deno runtime; revalidation needs a call back to the app | Want everything inside Supabase |
| **n8n (self-hosted / cloud)** | Schedule trigger → HTTP fetch → (LLM) → Supabase insert | No-code, visual, already installed on this machine, easy to add LLM node | Another service to run/keep alive; less "in-repo" | Fastest to stand up; non-devs tweak it |
| **External scheduler** (cron on a VM, Upstash QStash, Inngest, Trigger.dev) | Generic | Flexible, reliable queues | Extra vendor/infra | Need retries/queues at scale |

### Recommendation (free-first)

| Scheduler | Tier | Verdict |
|---|---|---|
| **GitHub Actions** | Free (2,000 min/month) | ✅ **Use this** — hourly cron, free, in-repo, logs in GH. Free tier is enough for ~1 run/hour × 24h × ~0.5 min = ~12 h/mo. |
| **n8n (self-hosted)** | Free self-hosted | ✅ Alternative — already installed here; visual, no code. Requires the machine to stay on + running. |
| **Vercel Cron** | Pro only (Hobby = daily) | ❌ Out at free tier — won't do hourly without paying. Defer. |
| **Supabase free tier** | Free (MCP 500MB, 50k RLS, 2 funcs) | ✅ Use for storage + reads. Ingestion writes stay under budget. |
| **LLM / paid API** | Paid | ❌ Skip for now — use the free heuristic from USY-18. Optional later. |

**Pick:** **GitHub Actions** (cloud, free, version-controlled) as the default;
**n8n** if you'd rather have a visual, no-code runtime. Both call the same
`runIngest()` in §4, so the choice is reversible with no rewrite.

---

---

## 4. The ingest route (framework-agnostic core)

`src/app/api/cron/ingest/route.ts` (or a shared `runIngest()` in
`src/lib/feeds/ingest.ts` reused by all schedulers):

1. **Auth** — reject unless `Authorization: Bearer ${CRON_SECRET}` (or n8n/GH
   passes the same secret). Prevents anyone from triggering writes.
2. **Fetch** — reuse `extractItems`/`normalizeItem` from `fetch-ai-news.ts`
   (refactor those into a shared module so the job and the fallback share code).
3. **Dedupe** — query existing `source_url` set + `(title, event_date)`; skip
   anything already stored. This is what makes hourly runs idempotent.
4. **Enrich** (optional, see §6) — for each *new* item, generate `body` +
   `significance`. Cap per run (e.g. 20 items) to bound cost/time.
5. **Persist** — insert into `stories` as `published` (auto) **or** into a
   `feed_candidates` staging table (editorial). See §7.
6. **Revalidate** — `revalidatePath('/')` + `updateTag('ai-news')` so the next
   timeline request is fresh. Return a JSON summary `{ fetched, new, enriched }`.

**Idempotency & safety:** dedupe-by-url means re-running is safe; wrap inserts so
one bad item doesn't abort the batch; log counts for observability.

---

## 5. Freshness vs. the 5-min cache

Even with hourly ingestion, keep the read path cached so the page is instant:
- Timeline reads DB behind `'use cache'` (`cacheLife('minutes')`, tag `ai-news`).
- Ingest calls `updateTag('ai-news')` → the cache busts exactly when new data
  lands. Net: **new items appear within a minute of the hourly run**, and the
  page never blocks on feeds.

---

## 6. Enrichment (ties to USY-19) — optional but recommended

To show a *readable article* instead of a one-line blurb, the same job can call an
LLM per new item to write `body` (3–5 paragraphs, source-only, factual) and a
sharper `significance`. Store both.

- **Cost control:** only new items, cap per run, skip if a `body` already exists,
  batch where the API allows. A few dozen items/hour is trivial for any provider.
- **Factual guard:** prompt = "using ONLY this title/summary/source, write N
  factual paragraphs; do not invent facts; if unsure, stay general."
- **Provider:** any chat-completions API (OpenAI/Anthropic/Groq/OpenRouter). Needs
  a key + budget. Can be added later without changing ingestion.

---

## 7. Editorial safety (auto-publish vs review)

The repo already has editor roles + RLS (USY-11) and a `feed_candidates` concept
(per `PHASE3_PLAN.md`). Two modes:

- **Auto-publish** — cron inserts straight to `stories` (published). Freshest, but
  no human check. Fine for Models/Products/Research.
- **Review queue** — cron inserts to `feed_candidates` (draft); an editor
  publishes → moves to `stories`. Safer; recommended for **Policy** or anything
  sensitive.

A pragmatic default: **auto-publish Models/Products/Research, queue Policy** for
review.

---

## 8. Data-model changes needed

- Add `body text null` (and optionally `enriched_at`, `key_points jsonb`) to
  `stories` — new migration `supabase/migrations/004_add_article_body.sql`;
  update `src/lib/supabase/types.ts` and `src/lib/schemas/story.ts`.
- (If review queue) a `feed_candidates` table mirroring `stories` minus publish
  fields.
- `page.tsx` reads `body` when present; article page renders it (USY-19).

None of this is required for the **first** hourly milestone — ingestion + dedupe +
revalidate alone already delivers "always fresh." Enrichment and the review queue
are additive.

---

## 9. Concrete plan (phased)

**Phase 1 — hourly freshness (no LLM, no review):**
1. Refactor `fetch-ai-news.ts`: extract `extractItems`/`normalizeItem` into
   `src/lib/feeds/shared.ts`; add `runIngest()` that dedupes + inserts to
   `stories` + revalidates.
2. Add `src/app/api/cron/ingest/route.ts` guarded by `CRON_SECRET`.
3. Pick a scheduler: `vercel.json` cron **or** `.github/workflows/ingest.yml`
   **or** an n8n schedule. Set it to hourly.
4. Point `page.tsx` at DB reads (keep feed fallback).

**Phase 2 — enrichment:** add LLM `body`/`significance` in `runIngest()` (USY-19).

**Phase 3 — review queue:** `feed_candidates` + editor publish (USY-11/12).

---

## 10. Still open? (free-first decisions)

1. **Scheduler** — decided: **GitHub Actions** (free). Alternative n8n if you
   prefer a visual runtime. Vercel Cron is skipped here (Pro only).
2. **Auto-publish vs review queue** — decided: auto-publish Models/Products/
   Research into `stories`; Policy goes to `feed_candidates` for an editor.
3. **LLM enrichment** — decided: skip for now. Use the free heuristic from USY-18.

---

## 11. Free-tier execution plan (the pragmatic path)

**Who pays nothing:** GitHub Actions free (2,000 min/mo) + Supabase free tier +
no API keys. This is the plan to run while the app is pre-growth.

### Step 1 — Ingest route (no key needed)
- Add `src/app/api/cron/ingest/route.ts` guarded by `CRON_SECRET` (set in GH
  Secrets / n8n / Vercel env). Only trusted callers write.
- Share the `extractItems` / `normalizeItem` helpers from
  `src/lib/feeds/fetch-ai-news.ts` so the job and the fallback use identical
  parsing.

### Step 2 — runIngest() core (free, no LLM)
1. Fetch the 6 RSS feeds (reuse existing `fetch-ai-news.ts` + the 5s
   `cacheLife('seconds')` / `cacheTag('ai-news')` already in place).
2. Dedupe against existing `source_url` + `(title, event_date)` before writing.
3. Insert new items into `stories` as `published` (set `is_published = true`).
4. `revalidatePath('/')` + `updateTag('ai-news')`.
5. Return `{ fetched, new, existing }` for logging.

### Step 3 — Trigger: GitHub Actions (hourly)
`.github/workflows/ingest.yml`:
```yaml
name: Ingest (hourly)
on:
  schedule:
    - cron: "0 * * * *"
  workflow_dispatch: {}
jobs:
  ingest:
    runs-on: ubuntu-latest
    env:
      CRON_SECRET: ${{ secrets.CRON_SECRET }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/ingest
```
Free tier: ~1 run/hour × 24h = 24 runs/mo ≈ well under 2,000 min.

### Step 4 — Supabase free tier (no changes to your plan)
- Keep `stories` + RLS + `getPublishedStories()` (USY-12). Ingestion only *adds*
  rows; nothing needs a paid tier for this workload.
- Migration 004 (`body` column) is **optional** — add it later when you want
  full article pages (USY-19). The hourly freshness works with title+summary
  only.

### Step 5 — n8n alternative (no YAML)
- In n8n, add a Schedule Trigger (every hour) → HTTP Request to
  `https://<your-app>/api/cron/ingest` (auth header), then continue with the
  same fetch/dedupe/insert logic using the HTTP Request node.

### Costs, honestly
| Item | Free tier status | Notes |
|---|---|---|
| GitHub Actions | ✅ free | 2,000 min/mo; ~24 min used per month |
| Supabase | ✅ free | MCP 500MB, 50k RLS rows; ingestion stays well below |
| Vercel hosting | ✅ Hobby forever | free app build + deploy; no cron on Hobby |
| LLM / paid API | ❌ skip | use USY-18 heuristic; optional later |

**Verdict:** $0/mo to keep the timeline updated hourly. Pay only if you want the
LLM enrichment or change to Vercel's paid cron.

---
