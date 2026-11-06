# Energy pie: the guide to the min straight (shares linear in kcal)

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

The user asked why the guide's edges, from the protein eaten now to its min and max at the calorie min, weren't
straight: [pie-guide](2026-11-06-pie-guide.md) had them straight in grams, which curves in the chart.

## Decision

- `pie.js` `guideToMin`: each edge's share linear in kcal, from the share eaten at the eaten ring to the target's
  share at the min (still never less than what's already eaten, at the min). Straight lines in the square; in the
  round pie, the angle grows evenly with the radius (a slight spiral).
- Checked in headless Chromium with the user's backup (2026-11-05: 1302 kcal, protein 23% → 28%–44% at 2000 kcal).
