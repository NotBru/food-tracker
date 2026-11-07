# Energy pie: the min and max bars brighter, outlined in green

- **Date:** 2026-11-07
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

The bars at the calorie min and max ([pie-past-min](2026-11-06-pie-past-min.md)) read about as dark as the history
around them. The user asked for them a little brighter, between the history's brightness and the eaten ring's, and
surrounded by a thin solid green line.

## Decision

- `pie.js` `barColour`: the zone's colour with 85% of its saturation left, 78% over the background (was 60%, 60%):
  half-way between the history (`hist`, 55% of the colour over the background) and the eaten ring (100%).
- Outline: `pieScene` returns `bars` ({L0, L1}: the whole levels each bar is drawn on, up to the history's top, so
  the line follows the part uncovered so far) and `barLine`, the app's green (`--kcal`, via `piePalette`). Drawn
  after the dashed curves, 1 px: the round pie two circles (the bar is a whole ring), the square a rectangle with its
  sides half a line inside the canvas. Web `Home.jsx` `PieCanvas`, Android `HomeScreen.kt` `drawPie` (`PieBand`).
- Checked in headless Chromium (a seeded day at 2640 kcal against a 2000–2500 target, round and square); the
  Android app compiles.
