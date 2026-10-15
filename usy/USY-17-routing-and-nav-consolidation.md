# USY-17 — Routing & navigation consolidation

**Status:** done

## Goal
Simplify the site to a single-page timeline after removing the landing page.

## What we did
- `/` is now the timeline (was `/explore`).
- Story detail moved `/explore/[storyId]` → `/story/[storyId]`.
- Deleted the old landing route, the globe module, and the `route-transition`
  view-transition provider + wheel-hijack.
- `revalidatePath('/explore')` → `revalidatePath('/')` in story actions.
- Header wordmark + "Back to timeline" both point to `/`; story cards link to
  `/story/<slug>`.

## Files
`src/app/page.tsx`, `src/app/story/[storyId]/page.tsx`, `src/app/explore-client.tsx`,
`src/lib/actions/stories.ts`, `src/app/layout.tsx`.
