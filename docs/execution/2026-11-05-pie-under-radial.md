# Energy pie: below the calorie min, the min's split (radial lines)

- **Date:** 2026-11-05
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

The user asked for the rings below the calorie min to be proportional to the macro profile allowed once the min is
reached (whilst satisfying the bounds there): radial lines up to the calorie target zone.

## Decision

- `pie.js` `ringShares`: below the min, every ring gets the min ring's shares (`calories: 'under'`, still faded). The
  gram targets aren't met down there; the split is the one that meets them at the min, eaten in proportion.
- If the macros can't fit at the min, the rings below are deep blue too (no profile to scale down).
- Above the max: unchanged (each ring's own shares, faded).
- The readout below the min reads the min's shares ("below the calorie min · Protein 27%–40%").

## Consequences

The pie's centre is no longer blue from the macros' minimums alone: the blue under the min now shows only when the
min ring itself can't fit them.
