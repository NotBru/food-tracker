# Error maths audit

- **Date:** 2026-10-16
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) ("Every value should also have a corresponding error")

## Context

User: "verify the math is good. Because conversion has two error fields. I'm guessing since the conversion rate
is the division, we get addition of relative errors. Audit the error math and ensure every bit is ok."

## How the maths works (`calc.js`)

- Every amount is an interval `[nominal, low, high]` (`span`). The low end is floored at 0.
- **Products** multiply the bounds (`mul`). **Quotients** divide by the opposite bound (`div`): low = a_lo/b_hi,
  high = a_hi/b_lo. Both are exact for non-negative quantities.
- **A conversion** "f ± Δf <from> = t ± Δt <to>" has the factor (t ± Δt)/(f ± Δf). The reverse direction uses
  the inverse interval. Built-in hops (g↔kg…) are exact multipliers.
- **A consumption's scale factor** is (amount ± Δ) × conversion ÷ (per-amount ± Δ).
- **Nutrient n ± Δn × factor [lo, hi]:** Δ = the largest distance from the nominal to any corner of
  (n ± Δn) × [lo, hi].
- **Recipes** recurse: each component's (already widened) Δ is scaled by the recipe's own factor interval.
- **Sums** (recipes, a day's total) add Δs linearly. Atwater energy is 4P + 4C + 9F + 7A, with
  Δ = 4ΔP + 4ΔC + 9ΔF + 7ΔA.

## On "relative errors add"

- That's the first-order rule. For a quotient the exact worst case is a bit larger:
  (1 + r_t)/(1 − r_f) − 1 = (r_t + r_f)/(1 − r_f) > r_t + r_f.
- The app uses the exact interval form, so it is always at least as wide as the sum of relative errors.
- Example: 1 ± 0.1 slice = 30 ± 3 g gives 1 slice = 30 g in 24.5–36.7 g. That is +22% / −18%, against ±20%
  first order.

## Test: app vs brute force vs first order

- **Method:** each case ran through the real `nutrientsFor` / `sumNutrients`. It was compared with a brute-force
  maximum over every corner of every input interval (the true worst case, because each formula is monotonic in
  every input) and with the first-order rule.

| Case | App | Brute force | First order |
|---|---|---|---|
| 250 g of 250±10 kcal/100 g | 625 ±25 | ±25 | ±25 |
| 250±5 g of it | 625 ±38 | ±38 | ±37.5 |
| 100 g of a food "per 100±10 g" | 100 ±11.11 | ±11.11 | ±10 |
| 2 slices, 1±0.1 slice = 30±3 g | 150 ±40.67 | ±40.67 | ±36 |
| 60 g of a per-slice food (reverse conversion) | 150 ±45.56 | ±45.56 | ±40 |
| 2 slices of a per-kg food (conversion + kg hop) | 150 ±40.67 | ±40.67 | ±36 |
| Toast recipe, 2±0.5 slices, 1 slice = 30±5 g | 150 ±68.75 | ±68.75 | ±62.5 |
| 150±1 g of a 2-component recipe "per 300±5 g" | 300 ±26.27 | ±26.27 | – |
| Atwater 4P+4C+9F from 10±1, 20±2, 5±0.5 | 165 ±16.5 | ±16.5 | ±16.5 |
| Sum of two consumptions | 725 ±36.11 | ±36.11 | – |

- All ten match the brute force exactly. 2100 ±188 against 1800–2200 is "over", as designed.

## Verdict

**No bugs found.** The maths gives the exact worst case whenever each uncertain input appears once in the
formula, which covers every case the app builds today.

## Known conservative choices (deliberate; noted so they aren't mistaken for bugs)

- **Symmetric Δ.** The up and down sides of a range can differ (division by an uncertain amount is skewed up).
  One Δ is stored, the larger side. So the low end shown is sometimes lower than the true worst case.
- **Same input used twice.** Errors are treated as independent worst cases. If the same uncertain quantity
  appears twice, it is counted twice, which over-states the error. Examples:
  - the same food in two components;
  - the burger's patty, estimated as "total minus the others".
  - The real range is narrower; never wider.
- **Digits default** is one unit of the last digit typed ("250" → ±1), not half a unit. That is conservative
  against rounding.

## Limits (not errors in the maths, worth knowing)

- **Only one custom conversion per path.** A path can't chain two of a food's own conversions
  (u → slice → g). It needs a direct one.
- **Atwater's own approximation isn't counted.** Its 4/4/9 factors ignore fibre and polyols. Estimated energy is
  marked "~".
- **Label values are often looser than their digits.** EU label tolerances are about ±20% for
  protein/carbs/fat, and ±1–2 g for small amounts. A label "3.5 g" gets ±0.1 from its digits. Typing a wider ±
  on label values gives more honest ranges.
