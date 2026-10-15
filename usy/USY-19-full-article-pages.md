# USY-19 — Full article pages with official link at end

**Status:** proposed (user: "take care after remaining issues are fixed")

## Goal
"The article page is generic; the user has to go to the official page to read.
I want a proper article, with the official article/URL at the end."

## Constraint
We store `title`, `summary`, `significance`, `source`, `source_url` — **no article
body**. A readable on-site article needs content we don't have yet. Full analysis
(Options A/B/C) is in [USY-06](USY-06-rich-previews-and-articles.md); recommendation
is **LLM enrichment (Option A)**, gated on the ingest pipeline (USY-20).

## Plan (when we pick it up)
1. Add `body` (+ optional `key_points`) to the Story schema
   (`src/lib/schemas/story.ts`) and a `body text` column in Supabase (new
   migration `004_*`); update `src/lib/supabase/types.ts`.
2. In the ingest/enrich step (USY-20), call an LLM to write a 3–5 paragraph
   article from title + summary + source; store as `body`. Prompt must stay
   factual (source-only, no invented facts).
3. Article page (`src/app/story/[storyId]/page.tsx`): render `body` as paragraphs;
   keep "Why it matters"; move the official URL into a clear
   **"Read the original article →"** footer. Fall back to today's summary view
   when `body` is empty.
4. Preview: surface the first paragraph / key points (ties to USY-18).

## Open decisions
- Enrichment provider + API key.
- Auto-publish vs editorial review (see USY-20).

## Files
`src/lib/schemas/story.ts`, `src/lib/supabase/types.ts`,
`src/lib/feeds/fetch-ai-news.ts` (or new job), `src/app/story/[storyId]/page.tsx`,
new `supabase/migrations/004_*`.
