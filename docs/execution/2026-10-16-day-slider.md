# Daily dashboard: day slider

- **Date:** 2026-10-16
- **Status:** superseded by [2026-10-16-day-arrows.md](2026-10-16-day-arrows.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen)

## Context

User: "I need a slider for the daily dashboard." When asked what it should control, the user picked "which day
is shown".

## Decision

- In the **daily** window, a range slider sits under the window header.
  - The right end is today. Each step left goes one logical day back.
  - It reaches back to the current user's first consumption, and at least 7 days.
- The title reads `Today · …`, `Yesterday · …` or `N days ago · Fri 2026-10-11`. The dashboard (totals, targets,
  budget, count) is for that day.
- A **Today** button next to it jumps back to today. It is disabled when already on today.
- The slider is **outside the header**, so dragging it isn't taken as a swipe between windows. Weekly and monthly
  don't show it and stay on the current week/month. The chosen day is kept when switching back to daily.
- The offset is relative to today, so after midnight (see [day rollover](2026-10-16-day-rollover.md)) "today"
  stays today.
- Helper `daysBetween` added to `time.js`.

## Alternatives considered

- **‹ › buttons per day.** They are already used to switch windows, and a slider is faster for going far back.
- **A slider for weekly/monthly too.** Not asked for; easy to add the same way.

## Verification

Headless Chromium. Seed: 300 g today, 2 × 500 g yesterday, 1000 g ten days ago (100 kcal/100 g).
- Slider range −10…0.
- Results:
  - 0: Today, 300 kcal, 1 consumption;
  - −1: Yesterday, 1000 kcal, 2 consumptions;
  - −10: "10 days ago · Tue 2026-10-06", 1000 kcal, 1 consumption;
  - −5: nothing logged that day, 0.
- Today button resets. Weekly has no slider.
- No console errors.
