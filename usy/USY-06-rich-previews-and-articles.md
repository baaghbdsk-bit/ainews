# USY-06 — Rich timeline preview + full article pages

**Status:** in-progress (preview done; full articles deferred per user — "take care after remaining issues are fixed")

## Goal
1. "In timeline preview we get a generic preview — add a little detail." ✅ done
2. "The article page is very generic; the user has to go to the official page to
   read. I want a proper article, with the official article/URL at the end." ⏸ deferred

## Part 1 — Non-generic preview (done)
Root cause: feed items got `summary` = bare title (when the feed's real body was
in `content`/`content:encoded`, not `description`) and `significance` = literally
`"Reported by <feed>."`.

Changes in `src/lib/feeds/fetch-ai-news.ts`:
- `bestSummaryText()` — picks the **longest** of `content:encoded` / `content` /
  `description` / `summary` (feeds scatter the real body), so previews show real
  text instead of the title.
- `stripFeedBoilerplate()` — trims WordPress "The post … appeared first on …" /
  "Continue reading" tails.
- `buildSignificance()` + `firstMeaningfulSentence()` — compose a real "why it
  matters" from the summary's first substantive (non-title) sentence + source +
  date, e.g. *"See how Amp pushes the frontier… Reported by OpenAI on Oct 14, 2026."*

Change in `src/app/explore-client.tsx`:
- `isRedundantWith()` — when "why it matters" was built from the summary's own
  first sentence, hide the now-duplicate summary block so the preview stays
  varied instead of showing the same text twice.

Verification (live): preview "why it matters" now reads as a real sentence with
source + date, not "Reported by X."

## Part 2 — Full article pages (deferred)
See the Option A/B/C analysis below. User will revisit after other items are done.

## The core constraint
We only store: `title`, `summary`, `significance`, `source`, `source_url`. **There
is no article body.** A "proper article" needs content we don't currently store.
Options documented below; recommendation is **Option A (LLM enrichment)** gated by
USY-07.

### Option A — LLM-written article from the feed item (recommended)
At ingestion (USY-07), call an LLM to write a 3–5 paragraph article from the
title + summary + source; store `body`, better `significance`, optional
`key points`. Render `body` as prose; keep official URL as "Read the original →".
- Pros: full control, readable offline, works for all feeds.
- Cons: needs an LLM key + cost; must stay factual.

### Option B — Scrape the original article body
Fetch `source_url`, extract main content (Readability). Real article, but sites
block scraping, messy HTML, copyright, brittle.

### Option C — Curated/editorial only
Hand-write articles for major milestones; feed items stay as blurbs with a
prominent "read original" link. Highest quality, no infra, but doesn't scale to
"always latest".

## Files
`src/lib/feeds/fetch-ai-news.ts`, `src/app/explore-client.tsx`, (pending)
`src/lib/schemas/story.ts`, `src/app/story/[storyId]/page.tsx`, Supabase `body`
column.

## Open decision (deferred)
Confirm Option A (LLM enrichment) + provider/key before building full articles.

