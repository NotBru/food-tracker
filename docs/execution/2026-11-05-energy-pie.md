# Dashboard style "energy pie": calories as the radius, the macros' shares as angles

- **Date:** 2026-11-05
- **Status:** accepted; three restricted macros provisional (open question); red zones superseded by [pie-blue](2026-11-05-pie-blue.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen, Config screen)

## Context

The user asked for a third dashboard style, chosen from Config (now a dropdown): one pie for calories, protein, fat
and carbs, using total kcal = 4·protein + 9·fat + 4·carbs. Radius is kcal. Rings below the calorie min and above the
max red. In between, each ring: green with no macro target; with targets, each restricted macro's share of that
ring's energy painted, its min in the middle and brighter segments on both ends out to its max; two macros'
overlapping parts grey (e.g. protein ≤ 60% and fat ≤ 50%: protein alone over 50%, 10% grey). Three restricted
macros: undecided ("let's go back and forth"). What was eaten: a white-edged ring with the eaten proportions.
Under the pie, only the other nutrients with a target.

## Decision

- Geometry in `app/src/pie.js` (no DOM, for the Android port); drawn in `screens/Home.jsx` (`PieDash`,
  `PieCanvas`).
- A target in grams is a share that shrinks as the ring grows (4·min / kcal), so the edges are curves, not straight
  wedges. The canvas is painted pixel by pixel, one ring per device pixel of radius (at least 2×, scaled down),
  each ring's arcs from `ringSegments(model, kcal)`.
- Places: restricted macros first (protein, fat, carbs order), the first centred on top, the second at the bottom
  (opposite, so two can overlap symmetrically on both sides, as in the user's example), the third split into two
  halves on the sides. Unrestricted macros don't draw a share: their room is the green.
- Each ring's ranges are narrowed by what the others leave (protein ≤ 1 − the others' minimums; ≥ 1 − the others'
  maximums), so a macro's min always wins over another's flank: the flank stops where the other can't go. A ring is
  red also where no split fits (minimums over 100%, or all three maxes under it): with macro targets the red shows the
  calories they imply even without a calorie target.
- A min only: its share, no flanks (the rest stays green). A max only: flanks from 0.
- Colours: a min in the macro's colour, its flanks that colour mixed halfway with white (brighter), overlaps grey,
  green as the bars' "ok" tint. Red zones are striped: plain red read as protein (coral).
- Scale: like a bar's, the max (or the eaten interval's top) at 80% of the radius, a lone min at 50%; also room for
  the macros' minimums' kcal.
- Eaten: a 9 px ring at the kcal eaten (`calories`, so registered energy where known), split by the macros' share of
  their own kcal (energy.js grams × 4/9/4; alcohol in grey beside carbs). First drawn as thick as the kcal interval:
  with real errors (±30–50%) it hid most of the targets, so the interval became two dashed circles in the range
  colour.
- A line under the pie reads a ring: the one eaten, or the one under the mouse / a tap ("1800 kcal: Protein
  22%–36%", or why it's red). A compact legend (eaten ± interval, % of energy, target ✓/↓/↑) opens each breakdown.
- Below: bars (`BarRow`) for every other nutrient with a target in the window.
- Config's style picker is the app's `Select` (native on a phone, a search box on a computer).

## Alternatives considered

- **SVG paths for the regions** — the edges are curves whose crossings change with the ring; tracing them is
  fiddly. Pixels per ring are exact and cheap (≈ 0.4–0.8 M pixels, one segment list per ring).
- **Ring as thick as the interval** — tried; see above.

## Consequences

- Android: not ported; with "pie" chosen (config syncs), the native home shows gauges and its Config highlights no
  style until the next port.
- Three restricted macros: the third's halves sit midway between the other two's minimums. Where nobody's flank
  reaches, the space is green though it must go to someone; positions don't show the coupling (C = 1 − A − B).

## Open questions

- Three restricted macros (raised in chat): keep the side split, show a ternary (triangle) plot of the feasible
  splits at the eaten kcal instead, or leave one macro out of the pie (as a bar).
- Radius from 0 kcal leaves the target band a thin annulus (1500–2100 kcal: 57–80% of the radius). Start the axis
  higher (e.g. the min less the band's width)?
