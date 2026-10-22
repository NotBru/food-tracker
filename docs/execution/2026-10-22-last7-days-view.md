# Breakdown from "last 7 days": a Days view first

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard); request in chat

## Context

User: "When I click the dashboard in 'Last 7 days', I'd rather just have the last 7 days sorted by consumption
amounts, rather than the specific consumptions. Well, add that as the default tab. And clicking on one of those
should go one level deeper into the days summary as you'd see it from the dashboard if you were looking at daily
stuff".

## Decision

- The dashboard's links to the [breakdown](2026-10-16-breakdown.md) now carry the window (`&win=last7`).
- With `win=last7`, the breakdown gets a third tab, **Days**, first and selected by default: Days · Ranked ·
  Quintiles.
  - One row per day of the window, largest first, drawn like the other rows: value ± Δ, share of the total, bar,
    then the number of consumptions and the range.
  - Every day of the window is listed. A day with nothing of this nutrient shows 0 and sits at the bottom.
  - Tapping a day opens `#/breakdown/<nutrient>?from=<day>&to=<day>`, the same screen as tapping that nutrient on
    the daily dashboard for that day.
- The group bar is hidden on the Days tab; ticking only happens on Ranked/Quintiles.
- Weekly and monthly breakdowns are unchanged (not asked for).

## Bug found while testing

The day's breakdown reused the 7-day screen's component, so it kept the Days tab. The breakdown is now keyed by
nutrient and dates in `main.jsx`, so each one starts fresh.

## Verification

Headless Chromium, consumptions on 6 of the last 7 days:
- Last 7 days → Calories opened on Days: 1200, 960, 600, 420, 300, 60, then the empty day at 0.
- Tapping the top day opened that day's breakdown on Ranked, with its 4 consumptions and no Days tab.
- Back returned to the 7-day breakdown on Days.
- Weekly → Calories still shows only Ranked · Quintiles.
- No console errors.
