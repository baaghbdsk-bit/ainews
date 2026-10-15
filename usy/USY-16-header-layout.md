# USY-16 — Header & topbar layout (logo + topic tabs)

**Status:** done

## Goal
A single sticky header row: brand on the left, topic tabs centered, always
reachable while scrolling.

## What we have
- `.archive-topbar` — `position: sticky; top: 0`, translucent dark background,
  horizontal flex with a responsive gap. Wordmark left (`flex: 0 0 auto`),
  `.topic-tabs-bar` fills the middle and centers the pill nav.
- `.topic-tabs-bar` / `.topic-tabs-scroll` — the tabs (USY-02) live inside the
  header; scroll container hides its scrollbar so a narrow viewport scrolls the
  pills cleanly instead of wrapping the header.
- Responsive: ≤1080px the tabs drop to a second header row
  (`.topic-tabs-bar { order: 3; flex-basis: 100% }`); ≤640px the tabs hide and
  filtering falls back to the sidebar panel (USY-03).
- The same wordmark styling is shared with the story page topbar
  (`.story-article-topbar`).

## Files
`src/app/globals.css`, `src/app/explore-client.tsx`.
