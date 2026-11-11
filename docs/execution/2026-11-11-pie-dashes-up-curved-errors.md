# Energy pie: the targets' dashed edges from the centre to the top, over everything; the error bars curved

- **Date:** 2026-11-11
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

The dashed lines at the macros' targets went from the centre to the calorie min (stopping at the min bar), plus
dashed curves only in the zone under the eaten history. The user asked for them from the bottom to the top, on top
of everything; then for the eaten split's error bars to follow the same curve: the macro's min to max amount, the
same kcal on every ring.

## Decision

- `pie.js` `pieScene`: `lines` from 0 kcal to the calorie target's lowest ring (no longer cut at the min bar);
  `curves` (`targetCurves`) from there to the top of the pie. Drawn last (`Home.jsx` `PieCanvas`, Android `drawPie`).
- `eatenShareRanges`: each macro's kcal at its interval's ends over the macros' summed kcal at their means (was: the
  others held at their means, so the total moved with it). `eatenErrorBars` gives each bar `span(f)`, its place on
  a ring of the eaten kcal / f. `pieScene` samples it across the bar's lane (`ERR_STEPS` pieces): `errs` are
  `{pts: [{L, from, to}], c, hatch}`, drawn as curved bands (`shapeOf` / `PieShape` `curvedBand`). Lanes still
  decided at the eaten kcal.
- The eaten arcs stay straight across the ring: a curved bar meets its arc's edge only at the estimate.
- First try (shown, not committed): the lines dropped, only curves from the calorie min up. The user wanted none removed.
- Checked in headless Chromium at 390 and 1000 px, round and square, with the user's backup: below the min
  (2026-11-11), inside the target (2026-11-09), above the max (2026-11-05). Android: compiles; not checked on the
  emulator.

## Consequences

- The dashes now cross the eaten ring, the bars and the history.
