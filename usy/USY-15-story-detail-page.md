# USY-15 — Story detail page

**Status:** done (full article body deferred — see USY-19)

## Goal
A dedicated page per story.

## What we have (`src/app/story/[storyId]/page.tsx`)
- Route `/story/<slug>` (moved from the old `/explore/[storyId]` in USY-17).
- Server component: resolves the story from Supabase first, then falls back to
  seed data; `notFound()` if neither matches.
- `generateStaticParams()` — prerenders a page per seed story.
- `generateMetadata()` — per-story `<title>`/description (Supabase, then seed).
- Renders: topic + date meta, title, summary, "Why it matters" (significance),
  and a source footer with the official URL.
- Topbar has the emphasized wordmark (USY-21) + a "Back to timeline" link to `/`.

## Files
`src/app/story/[storyId]/page.tsx`.
