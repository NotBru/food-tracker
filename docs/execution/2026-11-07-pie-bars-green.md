# Energy pie: the min and max bars shaded green, only their outer edge lined

- **Date:** 2026-11-07
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

After [pie-bars-outline](2026-11-07-pie-bars-outline.md) the user asked to remove the inner green lines and add a
slight green shading and a little more brightness.

## Decision

- "Inner lines" first read as each bar's edge towards 0 kcal (wrong, see below); no sides in the square.
- `barColour`: 86% over the background (was 78%), then 15% of the line's green mixed in.
- Checked in headless Chromium (the same seeded day, round and square); the Android app compiles.

## Correction

The inner lines meant the ones facing the zone between the bars: the min bar's upper edge and the max bar's lower
one. Now the lines are below the min bar and above the max bar (`pieScene` `barEdges`: levels; the max bar's as far
as it's drawn), and the bars brighter still: 90% of their saturation, 94% over the background, before the green.

Then "brighter still": the zone's own colours, unfaded (`segColour`), with the same 15% of green. The part where no
macro target applies stays its own deep blue (`free`), darker than the rest.

The user had meant the whole region to be brighter, not only the bars. The history between the green lines (from
the min bar up to the max bar, or the history's top) is now `zoneHist`: each macro's colour 80% over the background
(the rest of the history 55%), with the same 15% green. The bars keep the zone's full colours, so they still read at
its edges.
