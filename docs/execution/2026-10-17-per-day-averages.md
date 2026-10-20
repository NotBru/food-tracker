# Weekly and monthly dashboards: per-day averages

- **Date:** 2026-10-17
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard)

## Context

The user asked: "Let monthly and weekly dashboards use 'per day' averages, instead of totals."

## Decision

- **Divisor = days in the window with at least one consumption.** Same rule as the
  [weekly calorie correction](2026-10-17-weekly-calorie-correction.md): a day with nothing logged is "no data",
  not 0 kcal. So the current week/month isn't diluted by days still to come, or by days before tracking started.
- **Values and Δ** are both divided by that count (Δs of a sum add up, so the per-day Δ is the sum's Δ / n).
- **Targets** are the daily min/max **averaged over the same days**, each bound over the days that set it (replaces
  `windowTargets`, which summed them). With no logged day yet, they average over the whole window. Status, bars,
  gauges and Δ Budget follow, now per day.
- The dashboard footer says "· per day, over N days with consumptions" on weekly/monthly.
- Daily is unchanged (averaging over its one day is the same as before).

## Alternatives considered

- **Days elapsed (up to today)** — honest about forgotten days, but punishes days before tracking started, and
  every untracked day reads as a fast.
- **All days of the window** — the current week would look far under target until it ends.

## Consequences

- Today, half eaten, counts as a whole day and pulls the average down until it's over.
- The breakdown screen (opened from a row) still shows the window's totals; that screen lists what makes up the sum.
- Supersedes the "weekly/monthly use the summed max" line in [calorie budget](2026-10-15-calorie-budget.md):
  Δ Budget there is now average max − average (value + Δ).
