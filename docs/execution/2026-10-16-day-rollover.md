# "Today" rolls over without a reload

- **Date:** 2026-10-16
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: daily/weekly/monthly windows; Consumptions screen)

## Context

User: "It should update the day automatically. Right now I'm seeing yesterday's as 'today'."
- The homescreen and the Consumptions screen worked out today's logical day inside their `useLiveQuery`.
- Live queries re-run only on database changes, so an app left open (or resumed from the background) kept showing
  the day it was opened on.

## Decision

- New hook `useToday()` (`components.jsx`) returns today's logical day (respecting `config.dayStart`).
  - It re-checks every 30 s.
  - It also re-checks on `visibilitychange` (to visible) and on `focus`, because timers stall while a phone
    sleeps.
  - It only causes a re-render when the day string changes.
- Home and Consumptions (when no `?day=` is given) take that day as a query dependency. When the day changes,
  the window, the title and the totals move with it.
- An explicit `?day=` on Consumptions stays put. That screen was opened on a chosen day.

## Alternatives considered

- **Re-run the queries every minute.** That means pointless database reads all day.
- **A timer to the exact next day boundary.** It is unreliable on phones (suspended timers, clock or timezone
  changes), and the foreground check is needed anyway.

## Verification

Headless Chromium with a fake clock:
- At 04:59:40 (day start 05:00) the homescreen showed "Today · Thu, Oct 15". After 31 s it showed "Fri, Oct 16"
  with no reload.
- Consumptions moved from Oct 16 to Oct 17 when the clock was advanced a day.
- No console errors.
