# USY-18 — Content enrichment (non-generic text)

**Status:** done (preview + seed quality; LLM article bodies deferred to USY-19)

## Goal
"Improve preview description — not a generic one."

## What we did
Two layers:

### Seed data (curated quality) — `src/app/stories.ts`
- 2025 anchors (USY-05) each carry a real 2-sentence summary + a substantive
  "why it matters" — hand-written, not boilerplate.

### Feed items (derived) — `src/lib/feeds/fetch-ai-news.ts`
- `bestSummaryText()` — uses the **longest** available field so previews show the
  real body, not the title.
- `stripFeedBoilerplate()` — removes WordPress "appeared first on" / "Continue
  reading" tails.
- `buildSignificance()` — composes "why it matters" from the summary's first
  substantive sentence + source + date, instead of "Reported by X."

### UI dedupe — `src/app/explore-client.tsx`
- `isRedundantWith()` hides the summary when it would duplicate the "why it
  matters" line, keeping previews varied.

## Files
`src/app/stories.ts`, `src/lib/feeds/fetch-ai-news.ts`, `src/app/explore-client.tsx`.
