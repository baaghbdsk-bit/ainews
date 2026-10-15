# USY-03 — Timeline filter = period + search; fix date cutoff

**Status:** done (one mobile follow-up open)

## Goal
"Move topics to a top tab. In the timeline filter put only year + month + search.
Increase the distance between filter and timeline — dates are getting cut."

## Done
- Sidebar filter panel now contains **Period** (year + month selects) and
  **Search** only. Topic filter moved to header tabs (USY-02).
- Fixed the date-circle cutoff: widened the panel↔timeline gap
  (`clamp(28px,4vw,58px)` → `clamp(48px,5vw,72px)`), moved the timeline rail
  from `x:37px` to `x:55px` so it runs through circle centers, and added
  `18px` left padding to each row so the glow/runner no longer bleeds past the
  column edge.

## Files
`src/app/explore-client.tsx`, `src/app/globals.css`.

## Open follow-up
Mobile (≤640px): topic tabs hidden with no alternative — enable the scrollable
tab row on phones (see USY-02).
