# A supplements category with estimated, tight CVs

- **Date:** 2026-10-22
- **Status:** accepted; the CVs superseded by [supplements-evidence](2026-10-22-supplements-evidence.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); model from [`docs/notes/error-handling.md`](../notes/error-handling.md)

## Context

Creatine and whey had category 1008 ("foods for particular nutritional uses"), which counts as unknown: creatine got
the unknown "other" CV fitted on caffeine records (38% after √3). The user asked for a supplements class with tight
errors, by estimate.

## Decision

- New category 9901 "creatine, protein powders and similar", in its own group 99 "Supplements" (not CIQUAL's).
- Its CVs are estimates, not fitted and not scaled by √3: protein 5%, energy 5%, creatine/caffeine 3%, fat, carbs and
  sugars 15%, fibre and water 20%. Other kinds fall back to the fitted base × √3.

## Alternatives considered

- **Map 1008 to supplements** — 1008 also holds meal replacements and bars, which vary more.

## Consequences

- Creatine 1 u: 5 g −1.2/+1.5 at 90%; what remains is the unit "1 u = 5 g", read as 5 ± 1 g from its digits.
- Whey 31 g: 25 g protein ± 2.4.
