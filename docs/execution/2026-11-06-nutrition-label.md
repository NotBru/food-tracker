# Food Info: a printer button makes a nutrition label image

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen)
- **Extends:** [food-info](2026-10-16-food-info.md), [consumption-info](2026-10-20-consumption-info.md)

## Context

User: "I want a button that produces a standardized image of the nutritional values seen in a food's info. When in
the food info tab, I want a button with a printer, and clicking it should ask what units to use (default, as much as
was eaten, if coming from the food logs)".

## Decision

- **Button:** a printer icon (SVG, like the trash can) at the top right of a food's screen, on the Info tab only.
- **Sheet** (`LabelSheet.jsx`): "per <amount> <unit>" as in the Info tab, with preset buttons: "Eaten: 150 ±5 g"
  (when opened from a consumption) and "Food's amount: 100 g"; a live preview of the image; "Save image" shares it
  on a phone (share sheet), downloads it on a computer (the export's code, moved to `saveFile` in `components.jsx`).
  - Starts at the eaten amount when the food was opened from a consumption's info. Its link now carries
    `&log=<id>`, kept across the Edit/Info switch. Otherwise starts at the Info tab's "per" amount.
  - The eaten preset counts as the consumption does (`consumptionNutrients`: its ±Δ and entry error), so the label
    matches the consumption's info screen. Any other amount is exact, as in the Info tab.
- **Image** (`label.js`, a canvas, PNG at 2×, 600 px wide): always black on white, one layout, like a package's
  table:
  - "Nutrition facts", the food's label (wrapped), made-at for a concoction;
  - "Per <amount>", with the grams (or ml) for a counted unit ("≈ 135 ±15 g") or when it was eaten;
  - Energy in kcal and kJ; then fat (saturated, mono, poly › omega-3, trans), cholesterol, carbohydrates (sugars ›
    added), fibres, proteins, salt, sodium, alcohol (EU/US label order); a thick rule; the rest in the app's order;
  - value and its ± (the interval, as in the Info table) in two columns; "~" estimated, "*" missing in a component;
  - footer: what ± holds (the coverage), and the "~"/"*" notes when used.
  - Energy, fat, carbohydrates and proteins always shown (every label has them); others only when known and not 0,
    as in the Info table.
- File name: food name and amount, e.g. `granola-150-5-g.png`.

## Alternatives considered

- **Printing (window.print)**: the request is an image; the icon is the button's look.
- **A national format (EU, US FDA, Argentine with %VD)**: needs daily values and fixed rounding rules, and drops the
  errors. A neutral format in label order keeps the ± that the rest of the app shows.

## Consequences

- Web app only: the Android app's food Info is native and doesn't have it until the next port.

## Verification

Headless Chromium (390 and 1400 px), Granola per 100 ±1 g (470 kcal, P 10, F 20…), 1 bowl = 60 ±5 g; logged 150 ±5 g.
- Consumption info → food link opens `?tab=info&log=…`; Edit/Info keep `log`. The sheet starts at "Eaten: 150 ±5 g":
  705 kcal −160 +186, 2950 kJ, as on the consumption's info. "Food's amount" and "2 bowl" (≈ 120 ±10 g) redraw it.
- Without a log, a food with no registered energy at "per 3 u": the sheet starts at 3 u, energy "~549 kcal" with the
  estimate note; a long name wraps.
- Save image downloads `granola-2-bowl.png`. No console errors.

## Revision: energy by macro, dark

User: "Make it include the energy-by-macro graph, and have it be dark themed."

- Under "Per …": **Energy by macro**, the Info tab's donut redrawn on the canvas (`energySplit`, same slices, shades
  and 2 px gaps; the macros' total ± in the middle), its legend at the right (each macro, then its kinds: kcal, %),
  and the "from the grams" note. Then the table as before.
- The app's dark colours (`styles.css` `:root`): background, text, muted; thick rules in the text colour, row lines
  in the line colour. The preview in the sheet gets an outline, as it now matches the sheet's background.
- Size unchanged: 1200 px wide, height by content (the Gula burger: 1200 × 3584).

## Revision: the printer on a consumption's info too

User: on Calories → Nalga they found no printer: that opens the consumption's info, and the printer was on the food's
Info tab, a tap further (Food · info ›). "Add the printer to the meal data page".

- The consumption's info screen: 🖨 left of ✎, the same sheet starting at "Eaten" (the food's amount a tap away).
  Hidden for a deleted food.
- Two buttons on the top bar's right: `.topbar-actions`; the bar's side columns widen to 88 px when it is there, so
  the title stays centred.
- Verified in headless Chromium (390, 1400 px): breakdown → consumption → 🖨 shows "Eaten: 150 ±5 g", 300 kcal as on
  the screen; ✎ still opens the editor; a long name wraps beside the two buttons. No console errors.
