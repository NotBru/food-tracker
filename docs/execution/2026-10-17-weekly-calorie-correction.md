# Weekly calorie correction

- **Date:** 2026-10-17
- **Status:** superseded in part by [correction-per-bound](2026-10-18-correction-per-bound.md) (bounds now move independently)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard, Targets)

## Context

The user asked: "With a maximum correction of up to 500 kcal, specifically for calories, move the daily goal to
offset the weekly cumulative calories' discrepancy. I.e., if the daily average the last 7 days is different from
the target, it should aim to correct it at once today. Take into account the edge case where less than a week of
data is actually available."

## Decision

- **Daily window, calories only.** The day's calorie target moves by the discrepancy of the **6 days before it**, so
  the 7-day window that ends on that day (those 6 + the day itself) averages to the target. A past day viewed with
  the day arrows gets its own correction (from its own 6 days before).
- **Discrepancy** is per day, target vs. eaten, summed. The target's range is the goal; a single bound is the goal
  itself. Below the summed range → move up by the shortfall; above → down by the excess; inside → no move.
  Both bounds move together (the range keeps its width), never below 0.
- **Cap:** ±500 kcal (`WEEKLY_CAP` in `calc.js`).
- **Less than a week of data:** only earlier days with **at least one consumption and a calorie target** count. A day
  with nothing logged is treated as "no data", not as 0 kcal eaten (otherwise a new user, or one who skipped
  logging, would get +500 every day). With no such days there's no correction.
- **Nominal values** (no Δ) for the earlier days: worst case would bias every correction downwards. The budget line
  still uses today's worst case, against the moved max.
- **UI:** the range line, bar/gauge and Δ Budget use the moved target. A muted "7-day adj. ±N kcal" line (with
  "(cap)" when capped; tooltip gives the number of days used) appears only when the move is non-zero.
- Weekly/monthly windows are unchanged (they already sum the daily targets). *Later the same day they became
  per-day averages, see [per-day averages](2026-10-17-per-day-averages.md); still no correction there.*

## Alternatives considered

- **Mid-range as the goal** — would push someone sitting comfortably inside 1800–2200 back towards 2000.
- **Moving each bound independently** (min to hit the summed min, max to hit the summed max) — widens the range
  by its width × days; less "move the goal" than asked.
- **The 7 days before today** (an 8-day window with today) — the 6-day choice makes the rolling week land on target.

## Consequences

- One heavy day pushes down the next 6 days' goals as long as it's in their window, unless corrected; once
  corrected (e.g. eating at the moved goal), the next day sees a balanced week.
- Not ported to Android (`android/`), which also lags the other 2026-10-16/17 web changes.
- design.md doesn't mention the correction (not edited; human-only).
