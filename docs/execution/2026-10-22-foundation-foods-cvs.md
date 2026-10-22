# Sampling CVs from FoodData Central Foundation Foods

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); model from [`docs/notes/error-handling.md`](../notes/error-handling.md)

## Context

The user asked for more data for the CVs than SR28. Foundation Foods (FDC, 2026-04-30 release) publishes each
sample's analyses; 75% of its 3708 samples are one store purchase, not a blend.

## Decision

`data/scripts/fit_cvs_foundation.py` fits per-class CVs from the spread between samples (protein from nitrogen ×
the food's factor; carbohydrate and energy computed per sample, so correlations are kept). Output:
`data/foundation_fitted_cvs.csv`. `data/scripts/cv_table.py` builds the tables of `app/src/errors.js` from both fits.

Against SR28 (106 class × kind pairs) its CVs are 1.1× SR28's (median), not √3 ≈ 1.7×. Energy: meat 8.7% (SR28 ×√3:
14%), produce 10% (15%), grains 1.2% (3%), base 6.3% (7.4%).

Foundation Foods where a class has ≥ 10 foods for a kind, SR28 × 1.09 (the median ratio) elsewhere, replacing √3
(user's choice). 10, not 5: Foundation Foods' "dishes" are 6 hummus-like products against SR28's 472.
User's 2026-10-21 asado (309 g vacío, 797 kcal): −172/+199 → −114/+126 at 90%.

## Other sources checked

- **CIQUAL**: min and max are the extremes of all its data points for a food and component (those under 10 years
  old, or as old as the oldest used for the average), not percentiles; the number of points isn't published, so no
  SD can be derived. Confidence codes A–D grade sources, not spread.
- **Argenfoods** (UNLu): one value per food, no n or SD. It lists the same cut from several sources: cooked vacío
  203–258 kcal and 5–17 g fat per 100 g, which measures the "which entry" error rather than sample spread.
- Not fetched: IFCT 2017 (India, six-region sampling), World Agroforestry fruit table (mean, SD, n), FDC Branded
  Foods / Open Food Facts (brand-to-brand spread within a category).

## Open questions

- Argenfoods as a food source: ~470 foods with macros in per-group XLS files, INFOODS-tagged, but no licence stated
  (© UNLu) and no CORS, so it can't be bundled or fetched from the browser without UNLu's permission.
