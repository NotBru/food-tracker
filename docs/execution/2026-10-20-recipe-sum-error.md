# Recipes whose amount is their components' sum: the error isn't counted twice

- **Date:** 2026-10-20
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (errors on amounts, worst case); question in chat

## Context

The user added a concoction from the consumption sheet with three components: frozen yogurt (113 ± 40 g,
142 ± 52 kcal), chocolate (60 ± 25 g, 331 ± 139 kcal) and peanuts (30 ± 10 g, 187 ± 63 kcal). Its amount was
filled in as the sum, 203 ± 75 g. They ate 203 g, exactly, and the sheet showed **660 ± 789 kcal**, even though
the components' own errors add up to only ± 254.

`nutrientsFor` computed the components' nutrients (660 ± 254) and multiplied them by eaten / amount,
203 / (203 ± 75) = [0.73, 1.59], taking both ranges as independent. The high end therefore combines "every
component is at its heaviest" with "the whole concoction is at its lightest". That can't happen, because the
whole is just those components added up. The same error is counted twice, and the second time it's divided.

## Decision

When a recipe's amount ± Δ equals its components' sum ± Δ (`componentsTotal`, matched to Auto's rounding of 6 and
3 significant digits), `nutrientsFor` treats the two as one set of quantities:

- **Exactly its amount, with no error, means all of it.** This is what a blank amount eaten saves. The nutrients are
  the components' sum, with the components' own error: 660 ± 255 kcal here.
- **Any other amount** is a share of a total that moves with the components. Per base unit, the recipe holds
  Σ ρᵢtᵢ / Σ gᵢtᵢ. Here tᵢ is component i's amount, ρᵢ its nutrient per unit (with its error) and gᵢ the base
  units per unit of it (with the conversion's error).
  - The extremes are taken over every tᵢ in its range. They're at a corner where the components densest in the
    nutrient are at their high end and the rest at their low end, so only n + 1 corners need trying (`maxRatio`).
  - The result is then scaled by the amount eaten, with its error.
  - 100 g of the example is 325 ± 86 kcal, where it was ± 389 before.

A recipe whose amount was typed in independently, such as a cooked weight after water boiled off, is a separate
measurement. It keeps the independent treatment as before.

Checked with a script against the example: 203 g exactly gives 660 ± 255, and 100 g gives 325 ± 86. A brute-force
check over the corners gives the same high end. The weighed variant (203 ± 5 g) is unchanged. `npm run build`
passes.

## Alternatives considered

- **Always treating a recipe's amount as independent.** This is the old behaviour, and it gives the ± 789 above.
- **A stored "amount is the sum" flag.** It would be more explicit, but it means a new field and a migration. The
  consumption sheet already decides "follows the sum" by comparing values (`concoctionFields`), so this does the
  same.

## Consequences

- If a hand-typed amount happens to equal the sum ± Δ, it's treated as the sum. That's harmless, since it then means
  the same thing.
- Exactly the recipe's amount now reads as "all of it" in every view (dashboard, breakdown, info), matching the
  consumption sheet's own convention.
- Web app only.
