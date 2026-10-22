# Entry error per log

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); model from [`docs/notes/error-handling.md`](../notes/error-handling.md)

## Context

Day bars (±3.5–7.5% at 90%) looked too tight to the user. The CVs cover only sample-to-sample variation of a
well-identified food, not how far an entry is from what was eaten (generic entry, brand, cut, recipe). The user asked
for a ~10% entry error per log, set per food in the UI with a 10% default, 0 for foods read off their own label.

## Decision

- Foods without components get `entryError` (a fraction; missing = `DEFAULT_ENTRY_ERROR` = 0.1). The food form has
  an "Entry error, %" field beside the category; the info tab shows it. CIQUAL foods use the default.
- Each log (and each recipe component) adds (entryError × value)² to its independent variance: not shared between
  entries of the same food. Inside a concoction it becomes part of the concoction's shared deviation, like the rest.
- 10% is a back-calculation, not a fit: the Dutch duplicate-diet check (J Food Comp Anal 2015, 43:68; abstract
  only) gives carbohydrate, fat and protein limits of agreement whose spread is ~4% of a day's energy for weighed
  diets; over ~10 foods that is ~13% per food, of which ~5–8% is already in the CVs.
- The user's export got `entryError: 0` on its 12 branded, label-read foods (in `food-tracker-updated.json`, not
  committed).

Effect on the user's days (90%): ±4.8–9.9%, from ±3.5–7.5%.

## Alternatives considered

- **Shared per food** — the entry's mismatch recurs on every log of it; the user chose per log.
- **One global value** — wrong for label-read products.

## Consequences

- Label foods at 0 rely on their category CV alone for label inaccuracy (measured energy runs a median +4% above
  labels); no label bias is applied.
- `docs/notes/error-handling.md` (the user's) does not describe the entry error.
