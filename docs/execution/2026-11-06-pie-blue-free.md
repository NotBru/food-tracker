# Energy pie: no green; where no macro target applies, blue

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

The user asked for the green background to be deep blue "as the old one" and the desired zone a lighter blue. A
first try read it as the rings below the calorie min (the guide); the user meant the green itself (`free`, where no
macro target applies). That try was reverted.

## Decision

- `Home.jsx` `piePalette`: `free` #1e3a78 within the calorie target; faded (below the min, above the max) the same
  deep blue as `out` (#000421). The macros' colours, flanks, grey overlaps and the guide below the min: unchanged.
- Checked in headless Chromium: the user's backup in both shapes; protein + fat, square.

## Consequences

- Outside the calorie target, "no split fits the macros" and "no macro target here" now look the same (deep blue);
  the readout still tells them apart.
- Without macro targets the whole pie is blue: lighter within the calorie target, deep outside it.
