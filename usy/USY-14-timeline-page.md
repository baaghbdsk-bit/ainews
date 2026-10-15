# USY-14 — Timeline page (data merge + render)

**Status:** done

## Goal
The root `/` experience: a timeline of AI moments.

## What we have
- **Server** (`src/app/page.tsx`): merges three sources in priority order —
  1. `fetchAiNews()` (live RSS), 2. `getPublishedStories()` (Supabase),
  3. `stories.ts` seeds — dedupes by URL and by (title, date), sorts by
  `event_date` desc, projects each to a display shape, and renders
  `<ExploreClient>` behind a `<Suspense>` with a same-frame skeleton
  (`TimelineFallback`) so first paint never flashes empty.
- **Client** (`src/app/explore-client.tsx`):
  - Year dividers, per-row expand/collapse, active-node highlight driven by scroll.
  - Filters: topic tabs (header, USY-16), period (year + month) + search (sidebar).
  - Infinite-ish list: mounts `PAGE_SIZE` rows, tops up via IntersectionObserver +
    scroll/resize listeners near a sentinel.
  - Performance: `TimelineRow` is `memo`ized; search haystack cached in a WeakMap;
    redundant-summary check cached in a Map; `content-visibility` on rows.

## Files
`src/app/page.tsx`, `src/app/explore-client.tsx`, `src/app/stories.ts`.
