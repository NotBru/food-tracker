# Weekly calorie correction: each bound solves the 7-day average

- **Date:** 2026-10-18
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard, Targets); request in chat
- **Supersedes in part:** [weekly calorie correction](2026-10-17-weekly-calorie-correction.md) (how the range moves)

## Context

The user: "The target correction algorithm (up to 500kcal) should be such that the shown range for today is the
one required to be in range afterwards in the average."

The 2026-10-17 version moved both bounds together, by how far the earlier days' total fell outside their summed
range. So landing anywhere in today's shown range didn't guarantee a 7-day average within the target. And landing
outside it could still be fine. Example: target 1800–2200, 2200 eaten on each earlier day. There was no move, so
the range shown was 1800–2200. But anything from 1800 down to 0 (−6 × 400 for six earlier days) kept the average
in range.

Clarified in chat (after a detour where both bounds were briefly put back to moving together): *"The target for
today was the same as if every day before was correct. I need the following to hold: (max today + this week's
average omitting today × days this week) / total days == max calories. The minimum should follow the same
equation."* Asked whether that per-bound equation or "same shift for both" wins: **the equation, per bound**.
"This week" was first the calendar week, omitting today; the user then changed it to **the last 6 days**.

## Decision

- Each bound moves on its own, to exactly what today must land within:
  `min_today' = min_today + Σ(earlier mins) − Σ(earlier eaten)`, likewise for max. With N earlier days counted,
  today in [min', max'] ⇔ the (N+1)-day average is within the average target.
- Each bound's move is still capped at ±500 kcal (`WEEKLY_CAP`) and kept ≥ 0. Where the cap applies, the shown
  bound is no longer exactly what the average needs (it's the most the correction allows). The "(cap)" marker
  says so.
- **Earlier days = the 6 days before today** (rolling, crossing week boundaries), as in the 2026-10-17 version.
  Only days with consumptions and a calorie target count.
- **Averaged bounds** (user, later the same day: "Use the average of the max and of the min to compute the max
  and the min"): the right-hand side is each bound averaged over the counted earlier days plus today, each bound
  over the days that set it (`averageTargets`, as the Weekly dashboard does):
  `bound' = (N+1) × avg(bound) − Σ(eaten)`. With the same target all week this equals the sum form. It differs
  when the target changes within the window: an earlier day with only a max no longer stands in as a min.
  Example: max-only 2000 on Mon, 1800–2200 from Tue; 2100 and 2000 eaten Mon/Tue → Wed 1300–2300 (it was
  1500–2300 when Mon's 2000 also stood in as a min).
- **Worst case for the earlier days** (user report, same day: limit shown 2799 kcal; target max 2521; the 3 days
  with data "average to 2676" by their max; expected 4 × 2521 − 3 × 2676 = 2056). 2676 is the upper end of
  each day's error range. The code used nominal values (implied ≈ 2428/day, so Δ ≈ 248/day). Now the max is held
  against Σ(value + Δ) and the min against Σ(max(0, value − Δ)), matching the dashboard rule that a target only
  counts as reached if the whole error range is within it. This reverses the 2026-10-17 "nominal values" choice:
  with independent bounds, each worst case only pulls its own bound inwards, so there's no one-sided bias to
  avoid. `eaten` is now {day: {value, delta}}.
- Unchanged: worst case for today's budget against the moved max.
- UI: "7-day adj." shows one number when both bounds moved alike (always, for a single-bound target), else
  `min/max`, e.g. "7-day adj. −500/+0 kcal (cap)".

## Alternatives considered

- **Keep moving both bounds together** (one shift, from the midpoint or the max). Keeps the range's width, but
  the shown range isn't the one the average needs; offered and declined.
- **Calendar week (Monday to yesterday).** Matches the Weekly dashboard; briefly implemented, then dropped by
  the user for the rolling 6 days. So the daily correction and the Weekly dashboard's average can disagree.

## Consequences

- The range widens when the earlier days sat inside their range, and narrows (or flips direction) when they sat
  near one edge. With a range target and any earlier day counted, the adj. line is almost always shown.
- min' ≤ max' always holds: max' − min' = (N+1) × width before capping, and the cap and the 0 floor keep the order.
- `weeklyCorrection` now returns per-bound `shift`/`capped` objects (only `WeeklyAdj` reads them).
- Web app only, like the original.
