# Energy pie: a switch, a square tile among the others

- **Date:** 2026-11-05
- **Status:** accepted; layout superseded by [pie-fit](2026-11-05-pie-fit.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie; Config screen)

## Context

The user asked for the pie to be as wide as any other nutrient, square, shown or not by a toggle, keeping the rest
of the dashboard (energy, carbs, etc).

## Decision

- Config: a switch "Dashboard: energy pie" (`config.pie`) instead of the "pie" dashboard style. With it on, the pie is
  the first tile of the gauges or bars dashboard; every nutrient keeps its own bar or gauge (the `onlyTargets` switch
  applies as before).
- An old `dashboard: 'pie'` reads as bars with the pie on (`db.js` `getConfig`).
- The tile (`Home.jsx` `PieTile`): the pie as wide as the tile, square; the readout line under it. In gauges, it spans
  two gauges (one gauge, 140 px, is too small to read). Tiles in its grid row keep their height (`align-items: start`)
  rather than stretching to the pie's.
- The legend (eaten ± interval, % of energy, target per macro) is gone: the bars or gauges show the amounts and
  targets. The eaten split shows only as the eaten ring.

## Consequences

- Android: the switch is saved through forms.js, so the native Config keeps it; the native home doesn't draw the pie
  and shows no switch for it.
- On a wide screen, the tiles beside the pie leave space below them, up to the pie's height.

## Open questions

- The macros' % of energy eaten, lost with the legend: add it to the readout line or the macro bars?
