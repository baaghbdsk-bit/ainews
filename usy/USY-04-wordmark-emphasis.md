# USY-04 — Bigger, bolder, highlighted logo

**Status:** done

## Goal
"Make the logo bigger, it's too small and like a side character — highlight it."

## Done
- Wordmark base: `19px/700` → `23px/800`, slight negative letter-spacing.
- Archive/story topbar wordmark: `25px/800`.
- Orbit icon circle `30px → 38px`; on dark headers it gets a green tint
  (border `#d6ff5577`, fill `#d6ff550f`, glow `0 0 18px #d6ff5530`) so it ties
  to the accent-green language (active tab underline, year dividers, nodes).

## Files
`src/app/globals.css` (`.wordmark`, `.archive-topbar .wordmark*`,
`.story-article-topbar .wordmark*`).

## Validation
`tsc`/`eslint` clean · `next build` green · `/` and story page 200.
