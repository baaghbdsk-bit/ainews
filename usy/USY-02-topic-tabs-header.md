# USY-02 — Move topics into header tabs next to logo

**Status:** done

## Goal
"Our tabs are separated from the app — put them parallel to the logo, it'll
look good."

## Done
- Extracted the topic filter into a `TopicTabs` component.
- First rendered it as a full-width bar under the header; then, per feedback,
  moved it **inside** the sticky `archive-topbar`, centered between the wordmark
  and the right edge — so topic filtering is always reachable while scrolling.
- Horizontal-scroll pills with hidden scrollbar; active pill has a green
  underline. Roving-focus keyboard nav preserved.
- Responsive: ≤1080px tabs wrap to a second header row; ≤640px hidden
  (filtering falls back to the panel — see USY-03 open note about mobile topic access).

## Files
`src/app/explore-client.tsx` (TopicTabs + header), `src/app/globals.css`.

## Follow-up (open)
On mobile the topic tabs are hidden. Likely want them as a scrollable row on
phones too. Tracked under USY-03.
