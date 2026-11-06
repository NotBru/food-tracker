# Energy pie: dashed lines to the target, the path solid; a square shape

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie; Config screen)

## Context

The user corrected [pie-history-path](2026-11-06-pie-history-path.md)'s lines: the dashed ones go from the centre to
the target ring; the path from the eaten ring's outer edge to the target ring's lower edge is solid. And asked for a
square chart, calories up and the ratios across, with a toggle for the shape.

## Decision

- Dashed: the split eaten now, from 0 kcal to the calorie min (the max without a min; the eaten ring without either),
  drawn under the eaten ring. Solid: the path (`pathToMin`, unchanged), outer edge to the min. Both white at 55%.
- Square: the pie's right half unrolled (`Home.jsx` `shapeOf`): a row per kcal from the bottom, x = 2 × the angle.
  The pie mirrors itself, so nothing is lost, and each share reads straight off the x axis: the first restricted macro
  grows from the left edge (its min, then its flank to its max), the second from the right, the third between.
  Unrolling the whole turn instead would cut the second macro (or the third) in two at the edges.
- Everything else is shared: the pixels per level, the eaten band, the interval lines, the readout (pointing reads a
  row). Corners rounded a little.
- Config: "Energy chart" (was "Energy pie") and "Energy chart: square" (`pieSquare`), in the Dashboard block.
- Checked in headless Chromium: both shapes, a carb-heavy morning and a mixed day, 700 and 1000 px.

## Consequences

- No axis labels in either shape: kcal and shares by pointing, as before.
