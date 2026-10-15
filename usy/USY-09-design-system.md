# USY-09 — Design system & theme (dark "signal.")

**Status:** done

## Goal
A coherent dark editorial theme with a consistent accent language.

## What we have (all in `src/app/globals.css`)
- CSS custom properties in `:root`: `--paper #111611` (dark base), `--green #d6ff55`
  (primary accent), `--coral #ff755e`, `--blue #67b4ff`, `--violet #d28dff`,
  `--orange #ffb64c`, plus muted text/rule tokens and a serif stack.
- The accent-green is reused everywhere as the "brand thread": active topic
  underline, year dividers, timeline nodes/runner glow, the wordmark badge, and
  the topic-tab active state — so the whole UI reads as one system.
- Reusable components (classes): `.topbar`/`.archive-topbar`, `.wordmark`,
  `.archive-layout`, `.archive-filter-panel`, `.timeline-*`, `.story-*`,
  `.topic-tabs-*`, `.archive-search`, `.date-filter-select`, `.filter-*`.
- Responsive breakpoints: 1080px (single-column archive), 760px, 640px, 430px.
- Accessibility: focus-visible rings, `prefers-reduced-motion` override that
  neutralizes animations/transitions.

## Files
`src/app/globals.css`.
