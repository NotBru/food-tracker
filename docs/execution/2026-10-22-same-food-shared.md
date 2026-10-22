# Every entry of a food shares its error; a bakery class

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); model from [`docs/notes/error-handling.md`](../notes/error-handling.md)

## Context

The user distrusts how small the day bars are (±4–7% at 90%). Duplicate-diet studies put food-table energy within 10%
of analysis for only about 60% of days (BJN 1972, 38 of 63) and give roughly ±8% limits even for controlled-trial
diets (Wageningen 2015). Asked: count entries of the same food as the same sample; fix bread's reference.

## Decision

- `baseNutrients` (`app/src/calc.js`) puts a food's sampling and label error in a shared deviation keyed
  `food:<id>`, so every entry of that food, in logs, recipes and concoctions, on any day, adds linearly.
  This departs from the error document's "every new entry draws a sample" (user's request).
- New class `bakery` for moist baked goods (SR28 baked products, not sweet, > 20% water: breads, rolls, bagels,
  tortillas); CIQUAL 0302 breads and 0305 pastry dough use it. Crackers stay with grains. Energy CV 3.7%, from 1.2%.
- Fix in `fit_cvs.py`: foods with an alcohol row of 0 were skipped for energy; energy now fits on 3016 foods, not 827.
  The SR28-to-item ratio becomes 1.05.

## Consequences

- User's days: Oct 15 ±4.7% → ±5.3%; most days barely move, as few foods repeat within a day.
- The weekly correction now carries a food's error across days linearly.
- Still missing: how far an entry is from what was eaten (label vs product, generic vs specific). A ~10% shared
  "entry error" per food would bring days to about ±8–10%, in line with the duplicate-diet studies; not done.
