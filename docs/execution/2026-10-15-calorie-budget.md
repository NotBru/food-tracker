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
