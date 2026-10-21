# TODO

Open work that isn't started yet. Each item moves into a dated entry (see [README](README.md)) once it's worked on.

## Deal with the errors carefully

Requested 2026-10-21 ("carefully dealing with the errors"); the scope still needs pinning down with the user.
The error maths is exact worst-case interval arithmetic ([audit](2026-10-16-error-math-audit.md)), but several
choices make the ranges wider or cruder than the data warrants. Starting points:

- **Worst case adds up across a day.** Δs of independent consumptions add linearly, so a day of many small
  entries gets a range far wider than is realistic. Independent errors could combine in quadrature
  (√ΣΔ²), possibly with worst case kept for target checks. This is a modelling choice for the user.
- **Digits default is harsh on integer counts.** "1 portion" means 0–2 portions; "2 slices" ±1 gave Toast
  150 ± 320 kcal ([error bars](2026-10-15-error-bars.md)). Half a unit of the last digit, or exact counts for
  count units, would narrow it.
- **The same quantity counted twice** (the same food in two components, a part estimated as "total minus the
  others") over-states the error. Fixed only for a recipe whose amount is its components' sum
  ([recipe sum](2026-10-20-recipe-sum-error.md)).
- **Symmetric Δ.** Division skews the range upward, but one Δ (the larger side) is stored and shown, so the
  displayed low end is too low. The dashboard's range line and bars could carry low and high separately.
- **Label values are looser than their digits.** EU label tolerances are about ±20% for protein/carbs/fat;
  a label's "3.5 g" gets ±0.1. Imported (CIQUAL/OFF) values could get a source-based default error.
- **Atwater's own approximation** (4/4/9 ignoring fibre and polyols) isn't counted in estimated energy.
- **Android port** shows only "±Δ" and none of the later error work (range line, recipe sum).
