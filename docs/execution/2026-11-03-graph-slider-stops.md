# Time graphs: the days slider in months, weeks and days

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Time graphs screen)

## Context

The user: "have the slider for the time range of the graphs go between 12 months, 11, ..., 1 month, 3 weeks, 2 weeks,
13 days, back to 1. In that order." It went 1–180 days, left to right.

## Decision

- `graphs.js` `SLIDER_STOPS`, left to right: 12 … 1 months, 3 weeks, 2 weeks, 13 … 1 days (27 stops). "In that order"
  taken literally: the longest on the left.
- A month is a calendar month back from the last day shown (`time.js addMonths`, the day clamped to the month's
  end): on 2026-11-03, 1 month = 31 days, 12 months = 365. The URL and the box keep a number of days, as before.
- The slider sits at the stop with the span's days, else the nearest (30, the default, or a typed 45 → 1 month). Its
  `aria-valuetext` is the stop's name.
- The box still takes any 1–730.
- The 1-day view repeated its one date label (React duplicate keys): labels deduplicated, as core.js already did.
- Android: its slider is native (GraphsScreen.kt), still 1–180 days; the stops are in `android/README.md` Next port.

## Verification

Headless Chromium: each stop sets the days and the URL (365, 335, 61, 31, 21, 14, 13, 1); arrow keys step through
stops; a typed number moves the slider to the nearest stop; no console errors. `addMonths` on month ends and leap
years. `npm run build`.
