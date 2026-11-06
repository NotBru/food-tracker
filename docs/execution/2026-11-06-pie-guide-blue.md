# Energy pie: below the calorie min, deep blue with the macros' zones lighter

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

The user asked for the background below the calorie min (the guide from the eaten ring, [pie-guide-straight](
2026-11-06-pie-guide-straight.md)) deep blue as the old "can't fit" colour, not green, and the desired zone a lighter
blue.

## Decision

- `pie.js` `ringSegments`: below the min, with any macro target, two kinds only: 'want' where a macro's edge belongs
  (between its min and max share; past its min to what the others' minimums leave when it has no max) and 'out'
  (#000421) everywhere else, including under a macro's min. Not faded. Covers the guide and, with nothing eaten,
  the min's split from the centre.
- `want` #1e3a78. Without macro targets the rings below the min stay faded green (no zone to show).
- The target band and above it: unchanged.
- Checked in headless Chromium: the user's backup (protein only) in both shapes; protein + fat, square.
