# Energy pie: the min and max bars shaded green, only their outer edge lined

- **Date:** 2026-11-07
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

After [pie-bars-outline](2026-11-07-pie-bars-outline.md) the user asked to remove the inner green lines and add a
slight green shading and a little more brightness.

## Decision

- "Inner lines" read as each bar's edge towards 0 kcal: only the outer edge (`L1`) is drawn, a circle in the round
  pie, a row in the square (no sides, which would dangle without the lower edge).
- `barColour`: 86% over the background (was 78%), then 15% of the line's green mixed in.
- Checked in headless Chromium (the same seeded day, round and square); the Android app compiles.
