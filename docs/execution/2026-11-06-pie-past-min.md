# Energy pie: under the history, bars at the calorie min and max; the targets' curves between; error bars on the eaten split

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: energy pie)

## Context

Once the eaten ring passes the calorie min, the history inside it covers the target zone. The user asked for thin
bars showing the target's split (its min and max regions) right below the min and at the end of the zone, the
macros' boundary curves dashed between them, and error bars on the eaten split: each macro's share from its least to
its most likely amount, the others at their means.

A first round (shown, not committed) moved the bars with the eaten ring, each one ring's split all through,
as thick as the ring, darkened 22%, with dark whiskers in lanes across the ring for the error bars. The user's
corrections: the bars stay in place and appear as the eaten ring slides past; half as thick; colours a little less
faded than outside the target, not the full ones (those are the eaten ring's); the upper bar the zone's real shape,
its lower edge meeting the dashed curves (the lower one already did); error bars as the dashed elements used
elsewhere.

## Decision

- Bars (`Home.jsx` `PieCanvas`), half the eaten ring's thickness, drawn only under the history (so the eaten ring
  uncovers them as it moves up): right below the calorie min, the min's split all through (below the min every ring
  has it anyway); right below the max, each ring's own split (`ringSegments` per row). Colours `barColour`: the
  in-target colours faded with 60% of their saturation left, 60% over the background (outside the target: 40%, 42%).
- Curves (`pie.js` `targetCurves`): every restricted macro's min and max edges, sampled from the min up to the max
  bar's lower edge or the history's top, whichever is lower, dashed like the radial lines below the min, which now
  stop at the min bar. `ringIntervals` keeps zero-width ones on request so each edge keeps its index from ring to ring.
- Error bars (`eatenShareRanges`, `eatenErrorBars`): a macro's share k/(k + rest) at its kcal interval's ends
  (`bounds`), the rest at its mean, at its arc's moving edge: the first and second macros' both edges, the third's
  edge away from the first. Drawn on the eaten ring as the bars' error range (`.bar-err`): the macro's colour at 40%
  over the ring, hatched with 110° lines of its colour 60% with white, 1.5 px every 5 px. Where the third's overlaps
  another's (with no alcohol it shares its edge with the second), the third takes the ring's outer half and the
  other the inner one. Earlier tries: dark whiskers in lanes; dashed range-colour lines across the ring from the kcal
  interval's low end to its high end (the user asked for the nutrient's colour, hatched as on the bars).
- Checked in headless Chromium, offline but for the dev server, the user's backup copy imported and 2026-11-04 cut
  locally at 1500, 2000, 2035, 2260, 2521, 2560 and 3103 kcal (target 2000–2521, protein 140–218 g).

## Consequences

- At the eaten ring's 9 px the bands are small: they read on a computer, less so on a phone.
- No bars with a single consumption (no history to cover the zone).
