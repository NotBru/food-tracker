# Ghost: one grey band on the real bar's scale; "7-day adj." line removed

- **Date:** 2026-10-23
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard); request in chat
- **Supersedes in part:** [uncapped-ghost](2026-10-23-uncapped-ghost.md) (how the ghost is drawn; the "Uncapped"
  line), [weekly-calorie-correction](2026-10-17-weekly-calorie-correction.md) (the "7-day adj." line)

## Context

The user: "this is confusing as hell. Correct me if I'm wrong: the interval min-max used to be denoted with colors
only, no? now I'm seeing a bar right at the maximum? and another one at the beginning of the progressbar, but not at
the minimum? wtf is going on. Also, remove the -7 days adj.; that's useless clutter. Remove “uncapped:” too".

The ghost had its own scale (its max at 80%) and marked its min/max with ticks. Those weren't the real min/max, and
an uncapped min of 7 kcal put a tick at the start.

## Decision

- The ghost is one very faint grey band from the uncapped min to the uncapped max, on the **real** bar's scale
  (`barScale` in `calc.js`, shared with `targetBar`), so it lines up with the fill and the coloured regions. No ticks,
  no ghost fill. A missing bound runs the band to that end of the bar. Still only when a cap was hit.
- The "7-day adj." line (and its tooltip) and the "Uncapped:" line are gone.

## Consequences

- Over the bright fill the band barely shows; it reads over the track and the tinted regions.
- The caps aren't shown anywhere on the dashboard any more; the range line still shows the capped range.
