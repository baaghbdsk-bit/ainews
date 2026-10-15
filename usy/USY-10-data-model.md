# USY-10 — Data model & schema

**Status:** done

## Goal
A single canonical "story" shape used across seeds, feeds, DB, and UI.

## What we have
- **Zod schemas** (`src/lib/schemas/story.ts`):
  - `StorySchema` — the full story row (id, slug, title, summary, significance,
    source, source_url, topic enum, event_date `YYYY-MM-DD`, status, audit cols).
  - `CreateStorySchema` / `UpdateStorySchema` — picked subsets for writes.
- **Topic enum**: `Models | Products | Research | Policy` (single source of truth
  for both filter tabs and validation).
- **DB types** (`src/lib/supabase/types.ts`): hand-written `Database` type
  mirroring the `stories` table (Row/Insert/Update) for typed Supabase access.
- **Seed type** (`src/app/stories.ts`): a display-oriented shape (day/month/year
  split, color) used by the seed anchors.

## Files
`src/lib/schemas/story.ts`, `src/lib/supabase/types.ts`, `src/app/stories.ts`.
