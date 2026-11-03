# Food searches: foods already eaten first

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen)

## Context

The user asked: "Prioritize food that's already been registered soon, in the search". Read as: foods already logged
come early in the list. Builds on [food-search-ranking](2026-11-03-food-search-ranking.md).

## Decision

- `loadContext` gives `used`: id → when the current user last ate the food (their consumptions); concoctions and the
  components of any food count too, with no date.
- Order (`search.js`, the picker and the Foods list): (1) fewer words found only inside other words; **(1b) foods in
  use first**; (2) fewer partial-word matches; the screen's own order (the user's foods before CIQUAL's and USDA's;
  concoctions as before); **then the most recently eaten**; (3), (4) and alphabetical as before.
- So: logged "Oatly" comes before "Oat, raw" for "oa" and for "oat"; a logged "Pears, raw" (USDA) comes first for "pe".
  A logged "Spearmint tea" still comes after "Pears, raw" for "pear" (step 1).
- Picker with nothing typed: the user's foods, concoctions newest first, then the most recently eaten. The Foods list
  with nothing typed is unchanged (concoctions last).
- Android: its search runs search.js through core.js, so it comes with the next build.

## Alternatives considered

- **Before step 1 (in use always first)**: "pear" would list a logged "Spearmint tea" first, which the ranking was made
  to stop.
- **The user's own foods count as in use**: an own food never eaten ("Oat bar") would go above an exact reference
  match; only foods eaten, made or used in a recipe count.
- **By how often eaten**: recency is simpler and tracks current habits; the in-use tier already lifts the habitual ones.

## Verification

Headless Chromium on the dev server, real CIQUAL and USDA tables: the cases above, before and after logging.
`npm run build`.
