# Bars and gauges: 80% is the higher of the max and the value's top

- **Date:** 2026-10-23
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard); request in chat
- **Supersedes in part:** [targets](2026-10-15-targets.md) (where the max sits)

## Context

The user: "I want 80% to be `max(max_target, max_estimated_value)`". The max sat at 80% and anything past 100%
was clipped, so a value well over the max, or its error, ran off the end.

## Decision

- `calc.js barScale(range, n)`: 80% of the bar or gauge is the higher of the target's max and the top of the
  value's interval (`stats.js bounds`, the same interval the hatched part shows). The min is placed on the same scale.
- With only a min, which wasn't covered by the request: the min stays at 50% unless the interval's top would pass
  80%, then that top sits at 80%.
- The ghost band uses the same scale, so it lines up.

## Consequences

- When over, the max mark moves left, and different nutrients' bars no longer have their max at the same place.
- The value and its interval never clip. Only the ghost band can.
