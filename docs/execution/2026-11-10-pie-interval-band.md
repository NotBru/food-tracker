# Energy pie: the eaten ring as wide as the calories' interval, nearly the background outside the target

- **Date:** 2026-11-10
- **Status:** accepted; brightness superseded by [pie-ring-brightness](2026-11-10-pie-ring-brightness.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

The calories' interval was two thin dashed circles (rows in the square) at its ends. The user asked for the eaten
ring itself as wide as the interval, the part not in the calorie target darker, but not as dark as the history; then, as that
wasn't visible: the part in the target as bright as the zone, the rest as dark as the background, slightly brighter.

## Decision

- `pieScene`: the eaten ring spans the interval's ends (at least `PIE_RING`, then centred on the estimate; kept
  inside the pie); `mid`, `thick` describe it, its white edges at its ends, the history up to its inner edge, the
  error bars across its width. Its parts below the calorie min and above the max are `dims` ({L0, L1, from, to, c}:
  the split's colours 20% over the background, `OUT_OF_TARGET`; at 70%, between the ring and the history's 55%,
  it didn't show), drawn over the arcs; within the target the full colours, as the zone's. The min and
  max bars keep half `PIE_RING`. `rings` and `range` dropped.
- Android (`HomeScreen.kt` `drawPie`, `PieScene`/`PieBand`): the same.
- First try (shown, not committed): the eaten ring unchanged inside a separate darker band as wide as the interval.
  The user wanted the ring itself wider, the darker part where it leaves the target.
- Checked in headless Chromium at 390 px, round and square, with the interval below the target and across its max.

## Consequences

- The ring now hides the history and the zone's bars across the whole interval (the circles had been chosen to avoid that).
- The estimate itself is no longer marked on the ring; the readout under the pie gives it.
