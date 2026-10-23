# Time graphs: each dashboard nutrient per day

- **Date:** 2026-10-23
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard); request in chat

## Context

The user: "I want a 'Time graphs' button right below the dashboard, to take it to the data viz module. In the graphs
I want daily granularity, showing graphs for: {nutrient} vs. time, where the corresponding targets are shown and
the error bars for the measurements too, in the same filling style as the dashboard, each bar back to back".

## Decision

- Home: a "Time graphs" button between the dashboard and the menu → `#/graphs` (`screens/Graphs.jsx`).
- One chart per dashboard row: the macros, plus any nutrient a target mentions. The last N days, ending today: a
  slider (1–180) and a box (1–730), 30 by default; `?days=` keeps the choice in the URL. (First 14/30/90 buttons;
  the user asked for "a slider with a textbox".)
- Each day is a column, with no gaps between them. A column is a dashboard bar turned upright (`Home.jsx`'s
  `fillPieces`, `.zone`, `.bar-fill`, `.bar-err`):
  - the day's target as tinted regions (below min, within, above max);
  - the fill, solid up to the interval's low end and hatched up to its high end, each piece in its region's colour;
  - a white tick at the estimate.
- Calories use each day's weekly-corrected target, as the daily dashboard showed it. A day without consumptions
  shows its target and no fill.
- One y scale per chart: the highest of the days' bounds and interval tops sits at 90%. There are up to four
  1/2/5 gridlines, and dates at the start, middle and end.
- Tapping a column (hover with a mouse) picks that day in every chart. The line under each chart gives the value,
  ± error, the interval, and the target with ✓/↑/↓; tapping that line opens the day's breakdown. The picked day
  starts as today.
- `calc.js targetBar` takes an optional scale (`pos`), so every column uses the chart's one scale.

## Alternatives considered

- The dashboard's own scale (max at 80% per day): each column would have its own scale, so heights couldn't be
  compared across days.
- A charting library: the fill style is the dashboard's CSS, so plain divs reuse it as is.

## Consequences

- With 90 days the columns are a few pixels wide; the hatching then reads as a lighter band.
- The dashboard panel loses a button's height on short screens (it scrolls).
