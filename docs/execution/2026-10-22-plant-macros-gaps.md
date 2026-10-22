# Nutrient variability: plant-food gaps researched and merged

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** none — user request in chat ("Yeah" to: run one more research thread on the plant-macro
  topics the first run's budget cut off, and fold it into the report)

## Context

The full run's plant-macros thread ran out of tool budget after about 15 calls and left grapes, citrus, maize,
oats, nuts, vegetable water content, Cavendish by origin, potato storage numbers and apple/citrus storage uncovered
(its "Gaps" section). Two report claims (Veerman 2001; Montenegro potato dry matter) were still unverified.

## Decision

- One research thread (about 45 tool calls) wrote `research_notes/Nutrient content variability/plant-macros-gaps.md`.
- One independent checker re-opened its sources and recomputed its SR28 figures, testing each SE-derived SD
  against its own min–max (SD ≤ √((max − mean)(mean − min))): `fact-check/part-f.md`. 68 claims: 46 confirmed,
  18 corrected, 3 overstated, 1 unverifiable (not used).
- Fixes were applied to the report only, as in the first round; the notes stay as written next to their check.
- The report gains a section "In other plant foods, cultivar and water content set the spread". The banana
  section's water and grain paragraphs moved into it. Also changed:
  - Veerman: cultivar explains 10–40% (not 10–30%), now from the full thesis.
  - Montenegro: attributed to Arslanović-Lukač et al. 2021, abstract-level.
  - Potato starch: CV "up to about 0.24", replacing 0.33, which its own range rules out.
  - Uncertainty table: water, sugar/starch and fat rows get dry-matter, sweet-corn and nut-cultivar notes.
  - Gaps paragraph and "How this report was checked" updated.
- The notes folder is renamed to `research_notes/Nutrient content variability/`, completing
  [2026-10-22-nutrient-report-rename.md](2026-10-22-nutrient-report-rename.md); the report's link follows.

## Consequences

- The checker found SR28 SEs that exceed their own ranges for several foods. The report already flags this
  database-wide (9.3% of checkable records), and its headline medians barely move when those records are
  dropped (re-checked: most nutrients shift by ≤ 0.01), so the headline table is unchanged.
- Still open: Cavendish by origin or cold chain (no data after two searches), total-fat loss in stored nuts,
  genotype-versus-environment splits for maize and oats.
