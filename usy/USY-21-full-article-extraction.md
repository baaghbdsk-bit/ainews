# USY-21 — Full article extraction (zero cost)

**Status:** done

## Goal
Turn each one-line feed entry into a readable, detailed article on the story
page — so readers get the substance on-site instead of bouncing to the source.
Constraint: **zero cost**, same spirit as the free 30-minute ingest refresh.

## Why not just use the feed
Measured the actual feeds first: item bodies are only 158–258 char excerpts
(OpenAI, TechCrunch, Google), and some feeds (HuggingFace/The Verge) carry no
usable body at all. The RSS alone can't produce a real article.

## What we did
- **`src/lib/feeds/extract-article.ts`** — fetch the story's `source_url` with a
  browser-like UA (many publishers 403 a default agent), 8s timeout, size cap,
  5 MB limit, HTTPS-only, HTML content-type check, then a readability pass via
  `@extractus/article-extractor` (`extractFromHtml`). Output is flattened to
  plain text with blank-line separated paragraphs (never raw HTML) and capped at
  12k chars. Returns a status: `ok`, `unavailable` (too little text / not HTML),
  or `rate-limited` (HTTP 429). Requests are paced per host (min 1.2s gap, one
  in flight) so a burst can't trip a publisher's limiter.
- **`src/lib/feeds/ingest.ts`** — new enrichment pass: newest published rows with
  no body are extracted with bounded concurrency (5). A genuine failure bumps
  `enrich_attempts` so a bot-blocked/paywalled source can't starve the queue; a
  `rate-limited` result is left untouched (no attempt burned) and surfaced as
  `rateLimited` in the response so the caller backs off.
- **`supabase/migrations/005_add_story_body.sql`** — adds `body` +
  `enrich_attempts` + a partial index for the queue.
- **`/api/cron/ingest?mode=enrich`** — cheap enrich-only call so the scheduler
  can drain a backlog. The workflow loops until `remaining` is 0, breaking early
  when a source throttles us.
- **`src/app/story/[storyId]/page.tsx`** — renders the extracted body as
  paragraphs, and falls back to a live-feed lookup so a fresh headline never
  404s.
- **Timeline expand** — shows the article's opening paragraph as the overview
  when a body exists.

## Coverage (this project)
Drained the 891-row backlog: **861 have a body (97%)**, avg ~6.4k chars. The 30
remaining are genuinely unreadable via plain fetch — mostly Google AI Blog
(JS-rendered, 20) and a few 403/paywalled posts. They fall back to the summary.

## Cost
$0. No LLM keys, no paid service — a plain HTTP fetch + readability runs inside
the existing GitHub Actions cron.

## Known limits
- Client-rendered sites (e.g. blog.google) extract nothing → summary fallback.
- Some sources 403/paywall → retried up to 3 times, then left to the summary.
- Rate-limited sources (HTTP 429) are retried indefinitely but never counted as
  failures; per-host pacing keeps this rare.
- Stores a condensed plain-text version + attribution link, not verbatim HTML.

## Files
`src/lib/feeds/extract-article.ts`, `src/lib/feeds/ingest.ts`,
`src/app/api/cron/ingest/route.ts`, `src/app/story/[storyId]/page.tsx`,
`src/app/page.tsx`, `src/app/explore-client.tsx`,
`supabase/migrations/005_add_story_body.sql`, `.github/workflows/ingest.yml`,
`src/lib/schemas/story.ts`, `src/lib/supabase/types.ts`.
