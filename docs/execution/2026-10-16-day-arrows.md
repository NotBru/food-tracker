# Daily dashboard: day arrows instead of a slider; centred chevrons

- **Date:** 2026-10-16
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen)

## Context

User: "Sorry, I didn't mean slider. I meant arrow buttons. Also, center arrows in their circle please, they look
so wrong." This replaces [the day slider](2026-10-16-day-slider.md).

## Decision

### Day arrows
- In the **daily** window, a `‹ Today ›` row sits under the window header.
  - ‹ goes one logical day back. There is no lower limit.
  - › goes one day forward, up to today, and is disabled on today.
  - **Today** jumps back to today and is disabled when already there.
- The rest is as before:
  - the title reads `Today` / `Yesterday` / `N days ago · Fri 2026-10-11`;
  - weekly and monthly have no day row;
  - the chosen day is kept when switching windows, and the offset is relative to today.
- The slider, its "reach back to the first consumption" query and the `daysBetween` helper are removed.

### Centred chevrons
- The ‹ › buttons used text glyphs, which sit off-centre in a round button because of font metrics.
- A `Chevron` component (`components.jsx`) draws them as a 20 px SVG, centred on its box by geometry.
- It replaces every arrow glyph:
  - Back in every screen header;
  - the homescreen window arrows;
  - the new day arrows;
  - the Consumptions day navigator, whose buttons also gain aria-labels.

## Verification

Headless Chromium, same seed as the slider entry.
- Day stepping:
  - Today 300 kcal;
  - ‹ gives Yesterday, 1000;
  - ‹ ×10 gives "10 days ago · Tue 2026-10-06";
  - › gives 9 days ago;
  - Today resets.
- › is disabled on today. Weekly has no day row.
- Screenshots show the chevrons centred in their circles on Home and Consumptions.
- No console errors.
