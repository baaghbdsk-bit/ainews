# USY-12 — Story server actions (CRUD + cache revalidation)

**Status:** done

## Goal
Editorial writes to Supabase that keep the public timeline fresh.

## What we have (`src/lib/actions/stories.ts`)
- `getPublishedStories()` — reads published stories for the public timeline.
- `getStoryBySlug()` — reads one story for the detail page.
- Create / update / publish / unpublish actions, each:
  - validating with the Zod schemas,
  - checking `isEditor()` before mutating,
  - calling `updateTag('stories')` + `revalidatePath('/')` so the timeline
    refreshes immediately after an editorial change.
- Uses `next/cache` (`cacheLife`, `cacheTag`, `updateTag`, `revalidatePath`) —
  fits the `cacheComponents` model in `next.config.ts`.

## Files
`src/lib/actions/stories.ts`.
