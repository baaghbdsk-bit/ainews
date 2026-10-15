# USY-13 — RSS/Atom feed ingestion (live news)

**Status:** done (enrichment + scheduling deferred to USY-20)

## Goal
Pull live AI news so the timeline has recent, real-world moments.

## What we have (`src/lib/feeds/fetch-ai-news.ts`)
- 6 feeds mapped to topics: OpenAI, Google AI, Hugging Face, MIT Tech Review
  (Research), TechCrunch AI, The Verge AI (Products).
- `fetchAiNews()` — `'use cache'`, `cacheLife('minutes')`, tagged `ai-news`; fetches
  all feeds in parallel, normalizes, dedupes by URL, sorts newest-first, caps.
- Normalization (`normalizeItem`): extracts title/link/date, and:
  - `bestSummaryText()` — longest of content/description/summary (real body).
  - `stripFeedBoilerplate()` — trims WordPress tails.
  - `buildSignificance()` — composes a real "why it matters" line (see USY-18).
- Safety rails: HTTPS-only links, 3s timeout, 8 MB response cap, per-feed +
  global item caps, 4-year history window. Failing feeds are skipped.

## Files
`src/lib/feeds/fetch-ai-news.ts`.
