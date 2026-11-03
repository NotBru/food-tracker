# Time graphs: only the estimate's interval coloured

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Time graphs screen)

## Context

The user: "only color the error range (plus a light green overlay for the correct range), not the area below. […] A
region outside the target range is only colored if it falls within the estimate for that nutrient, red (for bad). A
region inside the target range is colored green. Dim green if outside the estimate for that nutrient, normal green
if inside. Keep the diagonal dashes". Columns were a dashboard bar standing up
([time-graphs](2026-10-23-time-graphs.md)): tinted under/ok/over regions, a solid fill up to the interval, hatched over it.

## Decision

- `graphs.js` `columnShapes` (Graphs.jsx and core.js, so Android draws the same with the next build): the target
  range as one light green zone (the old `.zone.ok`); the interval's hatched pieces only (`fillPieces`, cut at the min
  and max): green within the range, red outside it, grey without a target; no solid fill; no under/over zones.
- The white tick at the estimate is now drawn whenever the day has consumptions (it was only with an interval, when
  the solid fill's end showed the value), so a day with no interval still shows its value.
- The dashboard's bars and gauges are unchanged.

## Verification

Headless Chromium, 14 days with values under, within and over the targets (min only, max only, both): the cases
above. `npm run build`. Android not rebuilt.
