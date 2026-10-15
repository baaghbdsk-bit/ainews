# USY-01 — Remove landing page; timeline is the whole site

**Status:** done

## Goal
"Remove the landing page completely, it's causing issues. We will solely focus
on a simple website — landing = timeline."

## Done
- Deleted the WebGL globe module (`src/app/globe/`), the landing `hero-scene`,
  and the `route-transition.tsx` provider/wheel-hijack.
- Promoted the timeline (`explore/page.tsx`) to the root `src/app/page.tsx`.
- Moved `explore-client.tsx` and `stories.ts` up to `src/app/`.
- Story detail route moved from `/explore/[storyId]` to `/story/[storyId]`.
- `layout.tsx`: removed `RouteTransitionProvider`, retitled metadata.
- `revalidatePath('/explore')` → `revalidatePath('/')` in `src/lib/actions/stories.ts`.
- Removed landing CSS block + view-transition keyframes + `.archive-back-link`.
- Uninstalled unused deps: `three`, `@types/three`, `topojson-client`,
  `@types/topojson-client`, `world-atlas`.

## Files
`src/app/page.tsx`, `src/app/layout.tsx`, `src/app/story/[storyId]/page.tsx`,
`src/lib/actions/stories.ts`, `src/app/globals.css`, `package.json`, `package-lock.json`.

## Validation
`tsc --noEmit` clean · `eslint` clean · `next build` green · `/` and
`/story/<slug>` return 200 with correct markup.
