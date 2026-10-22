# Errors on every amount, worst-case target checks, error bars on the dashboard

- **Date:** 2026-10-15
- **Status:** superseded by [error-model](2026-10-22-error-model.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Consumptions screen, Foods screen: "Every value should also have a corresponding error", Homescreen: "show whether the target is being reached")

## Context

User, in chat: "I want the error to be available for the logs as well. And the bounds should be checked against
the worst case of the error bars. I want them to be visible from the dashboard."

## Decisions

### Consumptions get an error on the amount
- **Field:** `consumption.amountDelta` (≥ 0), edited in a "± Δ" field next to Amount.
- ~~**Blank means exact (0).**~~ Superseded: blank now defaults from the digits (see the last update). It does *not* default from the digits like nutrient values. "1 portion" would
  otherwise mean 0–2 portions, and "250 g" ± 1 g adds next to nothing anyway.
- **Propagation** (`calc.js consumptionNutrients`): the nutrient Δ widens to the worst case of (a ± Δa)·(n ± Δn).
  With v = a·n and δ = a·Δn, the new Δ is δ + (|v| + δ)·Δa/a. Totals then add Δs linearly, as before.
- **Display:** the Consumptions list and the editor preview show the error, e.g. "300 ±5 g" and
  "P 105 ±7.8 · … · 2100 ±188 kcal" (`MacroLine deltas`). Food lists keep the shorter line.
- **Migration:** none. Old consumptions have no `amountDelta` and count as exact. Exports carry the field as is.

### Targets are checked against the worst case
- `targetBar(value, range, delta)`: a target counts as **ok only if the whole interval [value − Δ, value + Δ] lies
  within [min, max]**.
  - If value − Δ < min, the status is **under**.
  - If value + Δ > max, the status is **over**.
  - If the interval spills over both bounds, the side the value is nearer to wins.
- Example: 2100 ± 188 kcal against 1800–2200 is **over** (worst case 2288), even though 2100 is in range.
- The Δ used is the one already shown on the dashboard. That includes the Atwater estimate's Δ when energy is
  unknown.

### Error bars on the dashboard (superseded below by the dashed fill)
- **Bars style:** a thin light line from value − Δ to value + Δ through the middle of the bar, with end caps,
  outlined so it shows on both the fill and the track.
- **Gauges style:** the same along the arc: a thin arc on the track's centre line with short radial caps.
- The bar's ends clip the error bar, like the fill. A row without a target, or with Δ = 0, draws none.
- The "±Δ" text next to each value is unchanged.

## Update: error range as a dashed fill

User: "Make the error-implied range in the dashboard just a segment (like the one that's been there since before
the error bars) that's colored with dashes instead of solid."
- The I-beam error bar is gone. The fill is now **solid from 0 to value − Δ**, then **dashed, same colour and
  thickness, from value − Δ to value + Δ**.
  - Bars use a repeating gradient (5 px on, 4 px off).
  - Gauges use `stroke-dasharray` on the same arc.
- **Where the dashes start, the solid part ends square:**
  - bars: rounded left corners only;
  - gauges: a butt-capped arc inside the track mask, which still rounds its start.
  Without an error range the fill keeps its rounded end.
- Clipping is unchanged: fill, dashes and markers all stop at the bar's end.

## Update: hatched band instead of dashes

User: "Looks bad. I want a single element, with a slightly transparent background of the original color, and the
dashes should be slightly diagonal lines with a slightly *clearer* (and solid) color."
- The error range (value − Δ to value + Δ) is **one band** continuing the solid fill.
  - **Background:** the status colour at 40 % opacity.
  - **Lines:** thin slanted lines in a lighter, opaque shade (`color-mix(currentColor 60 %, white)`).
- **Bars:** a single element with two background layers (a repeating 110° gradient over the see-through colour)
  and a rounded right end.
- **Gauges:** a 40 %-opacity arc plus hatch lines. Each line goes from the inner edge at p to the outer edge
  slightly further along the arc, so the slant is the same everywhere. A stroked-arc mask cuts the lines to the
  band; a clipPath would use the arc's fill, not its stroke.
- The dashed version above is superseded.

## Update: every amount has a Δ

User: "I don't see an amount delta for components. Every amount should have a delta field."

### New fields
All are stored as a number ≥ 0. Blank in the form means exact (0), for the same reason as consumptions.
- Food "per amount": `item.amountDelta`.
- Both sides of each unit conversion: `units[].fromDelta`, `units[].toDelta` (e.g. 1 slice = 30 ± 5 g).
- Component amounts: `components[].amountDelta`.
- Consumption amounts: `consumption.amountDelta` (as above).

### Maths: intervals instead of the earlier one-off formula
- Every scale factor is now carried as [nominal, low, high] (`calc.js`: `span`, `mul`, `div`, `unitFactorSpan`):
  - **consumption or component:** (amount ± Δ) × unit factor ÷ (per amount ± Δ);
  - **unit factor:** (to ± Δ) ÷ (from ± Δ). Built-in conversions are exact.
- A nutrient n ± Δn scaled by [f, lo, hi] gets Δ = the worst corner of (n ± Δn) × [lo, hi]. Δs of components
  and consumptions add up as before.
- This replaces the consumption-only formula; the results are identical when only the amount has an error.
  Recipes inside recipes compound naturally, because each level scales its components' (already widened) Δs by
  its own interval.
- **Validation:** a per-amount Δ or a unit Δ must be smaller than its amount. It is used as a divisor, and its
  low end would otherwise reach 0. Saving is refused with a message.

### UI
- Every Δ field shows a fixed "±" prefix (`DeltaInput`).
- Unit conversions take two aligned lines: "1 ±Δ slice ×" / "= 30 ±Δ g".
- The Foods list shows "per 100 ±10 g" when the per-amount has a Δ. The food editor's preview shows the Δs.

### Also fixed
- Jumping straight from one food's edit route to another (only possible by typing the URL) briefly reused the
  previous food's data, and the form kept it.
- A missing food id now shows "Food not found" instead of a blank screen.

### Verification (headless Chromium)
- **Bread:** 250 kcal/100 g, with 1 slice = 30 ± 5 g. One slice → **75 ± 12.5** kcal.
- **Toast** (recipe, 1 portion = 2 ± 0.5 slices of Bread) → **150 ± 68.75** (25–35 g × 1.5–2.5).
  With ± 1 slice → 150 ± 112.5.
- **Food per 100 ± 10 g** at 100 kcal; eating 100 g → **100 ± 11.1**.
- A unit Δ ≥ its amount is refused. No console errors.

## Update: amount errors default from the digits

User: "Deltas are not inferred from the digits in all fields, and they should by default."
This reverses "blank means exact". Every amount's Δ now behaves like a nutrient value's: blank means one unit of
the last digit typed ("250" → ±1, "250.0" → ±0.1, "1" → ±1). The placeholder shows that default; a typed Δ
(including 0) overrides it. Targets are unchanged, since their min/max are limits, not measurements.

### Storage
- Each amount now also keeps its typed text and an auto flag, because a number can't remember precision
  ("100.0" vs "100"):
  - item: `amountText`, `amountDeltaAuto`;
  - units: `fromText`, `fromDeltaAuto`, `toText`, `toDeltaAuto`;
  - components: `amountText`, `amountDeltaAuto`;
  - consumptions: `amountText`, `amountDeltaAuto`.
- The numeric Δ is still stored, so `calc.js` is unchanged.
- Helpers: `measure(text, deltaText)`, `amountText`, `deltaText` (`nutrients.js`). `DeltaInput` shows the
  default as its placeholder.
- Amount inputs are now text fields with a decimal keypad, like nutrient values. A number input can drop
  what was typed (e.g. a trailing "."), losing the digits the default depends on.

### Migration: Dexie v9, exports version 6
- An existing explicit Δ > 0 is kept, as non-auto.
- Otherwise the amount gets the digits default (auto). The exception is amounts that are **divided by** (per
  amount, both sides of a unit): where ±digits would reach 0, e.g. "1 slice", they become exact 0 so existing
  foods keep computing.
- Older export files get the same treatment on import.

### Divisors
- Per amount and both sides of a unit can't have Δ ≥ amount. That now includes the digits default.
- A blank Δ on "1 slice = 30 g" is refused with a hint: "type more digits (e.g. 1.0) or set a smaller ±".
- New unit rows start as "1 ± 0" on the left side.
- Imported drafts (CIQUAL/OFF) keep "per 100" and the "1" of "1 serving/package" exact. Those are definitions,
  not measurements.

### Consequence to be aware of
Integer counts get wide errors: "1 portion" means 0–2 portions. Through a recipe with "2 slices" (±1) and a
consumption of "1 portion" (±1), Toast came out at **150 ± 320 kcal**. That's the worst case of what was typed;
typing "1.0" or an explicit ± narrows it.

### Verification (headless Chromium)
- Migration from v8 data:
  - Bread: per 100 → ±1 auto; "1 slice" → ±0 exact; "30 g" → ±1 auto.
  - Toast component "2" → ±1 auto.
  - Oil's explicit ±5 kept.
  - Consumptions: 250 → ±1 auto, 1 → ±1 auto; an explicit ±2 kept.
- 250 g Bread → 625 ± 8.9 (hand-checked).
- In the editor, "250.0" → placeholder 0.1 → 625 ± 7. It was saved and shown as "250.0 g".
- A blank Δ on "1 slice" was refused; "1.0" saved.
- CIQUAL/OFF imports still save. No console errors.

## Verification

Headless Chromium (Pixel 7):
- **Seed:** one food at 700 ± 50 kcal, P 35 ± 2 per 100 g; consumption 300 ± 5 g. Targets: kcal 1800–2200,
  P ≥ 100, F ≤ 100, C 150–300.
- **Result:** kcal 2100 ± 188 → over ↑; P 105 ± 7.8 → under ↓; F 90 ± 4.5 → ok; C 210 ± 9.6 → ok. These match
  the hand calculation (±187.5 and ±7.85).
- Error bars were drawn in both styles. Raising Δa to 20 in the editor preview gave 2100 ± 300 kcal.
- No console errors.

## Update: dot at the estimate

User: "Add a circle right in the average of the estimate, in the dashboard."
- Inside the error band, a **dot marks the value itself** (the middle of value ± Δ). Both styles show it:
  - bars: an 11 px circle (`.bar-mean`), centred on the bar at `bar.fill`, drawn above the track so it isn't clipped;
  - gauges: an SVG circle, r = 4 (`.g-mean`), on the arc's centre line.
- **Look:** light fill (`--text`) with a thin ring in the background colour, so it stands out on the solid fill,
  the hatched band and the tinted track.
- It is drawn **only when there is an error band** (Δ > 0 and a target). Without one, the fill's end already
  marks the value. Dummy bars (no target) draw no dot.
- **Verified** (headless Chromium, the seed from the Verification section): the dot sits at 2100, 105, 90 and 210
  in both styles. No console errors.

## Update: see-through dot, square ends

User: "Make it transparent, no border. Change the borders from rounded to harsh."
- **Dot:** the ring is gone. The fill is the text colour at 50 % opacity (`.bar-mean`, `.g-mean`).
- **Square ends:** bars and gauges now end square, where they used to be rounded.
  - Bars: `.bar-track` and `.bar-fillbox` lose their `border-radius`.
  - Gauges: the track mask and the fill mask use `stroke-linecap: butt`.
  - The overshoot-then-mask approach is unchanged.
  - This reading of "borders" (the bar and gauge ends) is an interpretation.
- Verified in both styles (headless Chromium). No console errors.

## Update: tick instead of dot

User: "Better make it a short segment, darkish."
- The dot is now a **short dark tick across the band at the value**. It is the background colour at 85 % opacity,
  and it sticks out 2 px past each edge of the bar/arc, so it reads apart from the slanted hatch lines.
  - Bars: `.bar-mean` is 3 px wide.
  - Gauges: `.g-mean` is a radial line, stroke 3.
- A first try at the bar's exact height and 2–2.5 px wide got lost among the hatch lines.
- Verified in both styles (headless Chromium). No console errors.

## Update: white tick

User: "Make it white." The tick (`.bar-mean`, `.g-mean`) is now solid white. Its size is unchanged.
