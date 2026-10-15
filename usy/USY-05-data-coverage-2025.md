# USY-05 — Data coverage: fill the 2025 gap (and beyond)

**Status:** done (year-balanced ingestion deferred to USY-07)

## Goal
"We don't have any data for 2025 — please check that."

## Findings (verified against the live dev server)
- Seed file `src/app/stories.ts` had **only 2022–2024** anchors. No 2025.
- The timeline showed only a `2026` year divider because `fetchAiNews()` is
  newest-first and dominated by recent feed items; older years sit below the fold.

## Done
Added **13 curated 2025 milestone anchors** to `src/app/stories.ts`, spanning
Jan–Nov 2025 across all four topics:
- **Models:** Gemini 3 Pro, Claude Opus/Sonnet 4, Gemini 2.5 Pro, Llama 4,
  GPT-4.5 (Orion), Claude 3.7 Sonnet, Grok 3
- **Products:** GPT-5, GPT-4.1 API, Stargate ($500B)
- **Research:** DeepSeek R1
- **Policy:** US rescinds AI Diffusion Rule, EU AI Act prohibitions take effect

Each has a real 2-sentence summary + a substantive "why it matters" (not the
generic feed boilerplate), plus official `sourceUrl`.

## Verification (live)
- Year filter options now include **2025** (2026, 2025, 2024, 2023, 2022).
- All 13 titles render in the timeline HTML; each `/story/<slug>` returns 200
  (e.g. `/story/google-releases-gemini-3-pro`, `/story/anthropic-releases-claude-opus-4-and-sonnet-4`).

## Files
`src/app/stories.ts`.

## Note
Because feeds sort newest-first, 2025 seeds appear after the current-year feed
block. If we want years interleaved/balanced, that's the year-balanced ingest
idea in USY-07.

