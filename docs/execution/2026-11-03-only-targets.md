# Config: dashboard shows only nutrients with a target

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen, Homescreen)

## Context

The user asked for a Config toggle between the default rows (calories, protein, fat, carbs, plus any targeted
nutrient) and only the targeted ones.

## Decision

- A switch, `onlyTargets`, off by default (as before). On: the four always-shown rows follow the rule the other
  nutrients already had: a row when any target mentions the nutrient, even if no target covers the window shown.
- It's in `dashboard.js` `loadDashboard`, so the Android homescreen follows it too (config syncs); the Android Config
  screen keeps the key when it saves (its form is the web's JSON) but has no switch yet (`android/README.md` Next port).

## Alternatives considered

- **Only nutrients with a target in the window shown** — rows would come and go as you swipe between days or windows.

## Consequences

- With the switch on and no targets at all, the dashboard has no rows, only its count of consumptions.
