# Ghost bar: the uncapped correction, not the uncorrected target

- **Date:** 2026-10-23
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard); request in chat
- **Supersedes in part:** [correction-caps-ghost](2026-10-23-correction-caps-ghost.md) (what the ghost shows)

## Context

The user, on the first ghost (the uncorrected target): "Nah fam, I want the ultra-corrected ghost bar on top of the
normal thing. I want to know how much I should actually be eating if the caps weren't there".

## Decision

- `weeklyCorrection` returns `uncapped`: each bound moved by the full amount owed (still never below 0). `base` is gone.
- The ghost is the bar of `uncapped`, drawn the same way (faint grey fill, min/max ticks), and only when a cap was
  hit (otherwise it equals the real bar).
- With the ghost on, an "Uncapped: min–max kcal" line sits under "7-day adj.", so the number is readable too.

## Consequences

- After heavy days the uncapped min can drop to (near) 0: the whole excess is repaid in one day.
