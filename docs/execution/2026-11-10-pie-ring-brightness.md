# Energy pie: the eaten ring dimmer within the calorie target, brighter outside it

- **Date:** 2026-11-10
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

After [pie-interval-band](2026-11-10-pie-interval-band.md) the user asked for the ring's part outside the calorie
target slightly brighter, and its part inside between that and the target's own rings.

## Decision

- `pieScene`: outside the target the split's colours 30% over the background (`OUT_OF_TARGET`, was 20%); inside
  65% (`IN_TARGET`, was the full colours), halfway to the target's rings.
- The colours come in the scene, so Android needs no change.
- Checked in headless Chromium at 390 px, round and square, with the interval across the max.

## Consequences

- Inside the target the ring is now near the history's brightness below it; the white edge still separates them.
