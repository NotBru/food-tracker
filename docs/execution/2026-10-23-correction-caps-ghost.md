# 7-day calorie correction: caps in Config; a ghost of the uncorrected bar

- **Date:** 2026-10-23
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen, Homescreen dashboard); request in chat

## Context

The user: "Currently, today's bars are corrected up to an amount to try to make things right by end of day. The amount
is 500kcal, which I want to be configurable (for both min and max). I also want a toggable “ghost window” that shows
the actual actual bars you'd get. Should be very transparent grey over the gauge/progressbar".

## Decision

- **Caps:** `WEEKLY_CAP` is gone; config `adjCap: {min, max}` (default 500 each) sets how far each bound may move.
  Two fields on the Config screen; blank = default, 0 = no correction for that bound, negative refused.
- **Ghost:** config `adjGhost` (checkbox, default off). On the daily calorie bar/gauge, when the correction moved a
  bound, the bar of the uncorrected target (`weeklyCorrection` now returns it as `base`) is drawn over the real one
  in very faint grey: its fill (to the same end as the real fill, the interval's high end) and its min/max as ticks a
  little past the track's edges. The scale differs (the max sits at 80%), so the ghost fill is shorter or longer.
- The "7-day adj." tooltip names the cap(s) hit.

## Alternatives considered

- **Toggle on the dashboard** — Config keeps the dashboard clean and sits beside the caps; easy to move if wanted.
- **Ghost as a whole second bar (zones and colours) in grey** — the zones would stack over the real ones and blur
  them; fill + ticks carries the same information.

## Consequences

- Not ported to Android.
