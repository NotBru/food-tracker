# Food searches ranked by whole words

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen); user's TODO: "The search
  is a mess for simple things. Writting “pear” leaves the raw pear way below random shit, how do we deal with that?"

## Context

The Foods list and the food picker (consumptions, components) kept every food whose text contains each typed word
anywhere, then sorted: the picker alphabetically, the Foods list's reference foods by label length. "pear" has 74
matches among CIQUAL and USDA; in the picker "Pears, raw" came 60th, after "Babyfood, …pears…" and the like, and
"Spearmint" matched too. The log-food skill's `find` already ranked by words and did well.

## Decision

`app/src/search.js`, used by both:
- A typed word matches a word of the food's name and brand (or CIQUAL's French name): the same word (plurals aside:
  `pears` = `pear`, `tomatoes` = `tomato`), its start (`roast` in `roasted`), or a longer form of it. Else anywhere in
  its text, as before, so nothing that matched before is lost (and `pears` now finds "Pear, …" too).
- Order: (1) fewer words found only inside other words; (2) fewer matching only part of a word; then the screen's own
  order (the user's foods before CIQUAL's and USDA's; concoctions as before); (3) the name starting with the first
  word; (4) fewer other words in the name, "raw" not counted (it's the plain food); then alphabetical.
- With nothing typed, both lists are as before.

## Alternatives considered

- **The user's foods always first, as before**: a poor match of theirs ("Spearmint tea") would still sit above
  "Pears, raw". Theirs come first among equally good matches.
- **Word-start matches only**: "milk" would stop finding "buttermilk"; such matches are kept, just ranked lower.
- **Sharing the skill's scoring code**: it weighs rare words using the whole tables and runs in Node; the app's needs
  are simpler, and the two share the approach.

## Verification

Over the real CIQUAL and USDA tables: "pear" → Pears, raw; "egg" → Egg, raw; "oat" → Oat, raw; "banana" →
Bananas, raw; "milk whole" → Milk, whole, raw; "dulce de leche" → Dulce de Leche. ~25–50 ms per search over the
~11k foods (100 ms the first time). In headless Chromium the Foods list and the consumption editor's picker both list
"Pears, raw" first for "pear". `npm run build`.
