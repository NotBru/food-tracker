# Dashboard bar notes: measured as drawn, one line per lane

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen)

## Context

The user: the Android app's dashboard is better finished; its numbers share a line (top or bottom) with a minimum
distance, and the web app's should never overlap either. [bar-notes](2026-11-03-bar-notes.md) measured each note
with canvas `measureText` in the CSS font. Text drawn bigger or in another font than that (Android's text scaling,
font inflation, a fallback font) made widths too small, so notes overlapped. In headless Chromium with the notes'
text scaled up, the old code put "1800" and "2350" 2.4 px into each other. Android measures the real text, so it
doesn't happen there.

## Decision

- `Home.jsx` `useWidths`: each note's width as rendered (`getBoundingClientRect`), measured before paint, again when
  a note resizes on its own (ResizeObserver). `spreadNotes` (unchanged, the same as Android's) places them with these.
- A lane is a flex row on one baseline (`last baseline` above the bar, as Android's baselines), notes in bar order,
  each placed by its left margin; lanes' heights in em, so bigger text grows them instead of spilling onto the bar.
- The budget label is measured the same way.

## Consequences

- When a lane's notes are together wider than the bar (very narrow screen with big text), they still run past its
  right end, as on Android; never over each other.

## Verification

Headless Chromium, crowded targets (min and max close, value near them), at 412 and 300 px, normal and scaled-up
text: no two notes in a lane closer than the gap. Before/after screenshots match at normal size. `npm run build`.
