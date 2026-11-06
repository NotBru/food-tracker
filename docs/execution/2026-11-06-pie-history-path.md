# Energy pie: the day's eating inside the eaten ring; the path to the calorie min

- **Date:** 2026-11-06
- **Status:** accepted; the lines' extent and style superseded by [pie-square](2026-11-06-pie-square.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

The user asked for: from the centre to the eaten ring's inner edge, the macro profile as a function of the energy
eaten through the day; transparent dashed radial lines from the centre to where the split is now; the same lines from
the ring's outer edge to the calorie min, "showing the linear path to getting there".

## Decision

- `dashboard.js` `eatingSteps`: running calories and macro grams after each consumption, in time order (per day
  over longer windows, like the total). `pie.js` `eatenAt`: the grams once k kcal had been eaten, linear within a
  consumption, scaled so the last step meets the ring's kcal (registered energy can differ from the summed one).
- Inside the ring each ring of pixels is `eatenArcs` of that, in the eaten ring's places and colours, 55% towards the
  background (the ring itself stays bright). The targets' colours aren't drawn there.
- Radial lines: the edges of the eaten split now (`eatenEdges`), white at 55%, dashed, centre to the ring's inner edge.
- Path (`pathToMin`): "linear" read as straight in grams: the rest of the min eaten at one mix, so each edge's angle
  follows the running split (a curve in the pie, straight when the split eaten now is already allowed at the min).
  The end: the split allowed at the min (`ringShares`) nearest to the one now (every share moved by one amount,
  clamped to its bounds), never less of a macro than already eaten, no more alcohol. No path without a calorie min,
  past it, or when no allowed split can be reached.
- The readout inside the ring: "688 kcal eaten: Protein 43% · Fat 20% · Carbs 37%".
- Checked in headless Chromium with seeded consumptions: a mixed day (path straight) and a carb-heavy morning (the
  path widens protein and fat out to their minimums at the min).

## Alternatives considered

- **Straight segments on the drawing** from the ring to the min — a split doesn't move along straight lines in the
  pie, so they wouldn't match the rings they cross.

## Open questions

- Path's end: the nearest allowed split; another choice (the middle of the allowed ranges) would aim for room to spare.
