# Error model: distributions instead of worst-case bounds; categories; CIQUAL in the food database

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); model from [`docs/notes/error-handling.md`](../notes/error-handling.md)

## Context

Worst-case intervals summed to ±300 kcal a day, which the user found unusable. The user wrote the error model in
`docs/notes/error-handling.md` and asked for: a category dropdown on foods not composed of other ingredients (default
unknown, wide errors), a config setting for the share of probability the interval holds (default 90%), and CIQUAL
inside the food database behind a config toggle, with OFF left where it was.

## Decision

- Every computed nutrient is `{value, v, s}` (`app/src/stats.js`): `v` holds independent variance, `s` holds SDs shared
  within one sample (a concoction's portions), which add linearly. Everything else adds in quadrature. A product with
  an independent amount uses Var = f²σb² + b²φ + σb²φ.
- The lognormal is fitted only at the end: σ² = ln(1+s²/m²), μ = ln m − σ²/2. The interval is the centred
  `coverage` share (config, default 0.9, z from Acklam's inverse normal).
- Nutrient per gram: CV by category class and nutrient kind (`app/src/errors.js`). These are v1 judgement priors from
  the per-nutrient budget in the variability report. All biases are 0. Categories are CIQUAL's 64 subgroups, 0101–1104,
  grouped into classes (produce, fruit, meat, dairy, …). "Unknown" is wide: energy 25%, fat 40%.
- The label's rounding (digits Δ) is read as uniform: σ = Δ/√3. Typed amounts' Δ are read the same way.
- Nutrient Δ inputs were removed; the digits Δ is kept. Amount Δ inputs remain (user's choice).
- Recipes: their components' distributions are summed. Total weight P is treated as exact. A concoction moves its
  variance into a shared key, so 2×100 g of it equals 1×200 g, not √2 less.
- The category is saved only for foods without components.
- A target counts as reached only if the whole interval lies within it, as before; the interval is now the coverage
  interval.
- The weekly correction comes from the interval of the earlier days' summed energy, not from per-day bounds.
- CIQUAL foods are virtual read-only items (`ciqual:<code>`), category = their subgroup. They appear in food search
  and pickers after your own foods (Foods list: 50 at most). Editing one opens a prefilled copy that saves as your own
  food. The External screen is now OFF only.

## Alternatives considered

- **Lognormal at every step** — sums of lognormals aren't lognormal; carrying mean and variance is exact for these
  sums and products.
- **Keep nutrient Δ fields** — the user chose to drop them; the category's CV replaces them.
- **Import CIQUAL into the DB** — copies 3000+ rows into every export; virtual read-only items avoid that.

## Consequences

- Supersedes the worst-case parts of [error-bars](2026-10-15-error-bars.md),
  [recipe-sum-error](2026-10-20-recipe-sum-error.md) and [correction-per-bound](2026-10-18-correction-per-bound.md).
- The Android port is not updated.
- The CVs are priors, not fitted. Biases can be set per class later.

## Open questions

- `design.md` still says every value has a Δ field, and lists CIQUAL as a V2 external search. Both now differ; the
  human-only doc needs updating by the user.
