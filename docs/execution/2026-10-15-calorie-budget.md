# Calorie budget

- **Date:** 2026-10-15
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard, Targets)

## Context

The user asked for a "budget" on the calories dashboard, using the target's maximum calories and the maximum
calories according to the error.

## Decision

- Budget = target max − (value + Δ): the most that may have been eaten so far is value + Δ, so this is what's
  surely left (worst case, in line with the worst-case "reached" rule).
- Shown under the calories range line, in both dashboard styles: "Budget **58** kcal" (number green), or "Over
  budget by **N** kcal" (number red) when it's at or below 0.
- Only for calories, and only when the window's target has a max. Weekly/monthly windows use the summed max, like
  the bar.

## Alternatives considered

- **max − value (± Δ)** — the nominal budget; not what was asked, and it can promise calories that aren't there.

## Consequences

- With wide errors (e.g. portion counts) the budget runs out early; that's the intended caution.
- design.md doesn't mention the budget (not edited; human-only).

## Update (2026-10-16): one "Δ Budget:" label

User: "'Over budget by' ends up not displaying anything, since it caps the number. Use 'Δ Budget:'."
- On a tile the line is cut with an ellipsis. "Over budget by 88 kcal" lost its number on narrow tiles.
- **One short label for both cases:**
  - under budget: "Δ Budget: 325 kcal" (number green);
  - over budget: "Δ Budget: −88 kcal" (number red).
- The maths is unchanged: max − (value + Δ).
- Verified at 360 px wide: both lines fit (no clipping). No console errors.

## Update (2026-10-17)

Weekly/monthly windows no longer sum: values and targets are per-day averages, see
[per-day averages](2026-10-17-per-day-averages.md).
