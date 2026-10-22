# Execution log

Written by Claude (and other agents) while doing the work. Records *how* the
instructions in `docs/instructions/` were carried out and *why* choices were made.
Humans read and may comment, but direction belongs in `docs/instructions/`.

## What goes here

- Design decisions and the alternatives considered
- Assumptions made where instructions were silent or ambiguous
- Open questions for humans
- Notable deviations from instructions, with justification

## Conventions

- One file per decision or work session: `YYYY-MM-DD-short-slug.md`
  (e.g. `2026-10-15-database-choice.md`). Copy `_template.md` to start.
- Entries are append-only in spirit: if a decision is reversed, write a new entry and
  set the old one's status to `superseded by <file>` rather than rewriting history.
- Always link the instruction file(s) the entry serves.
- Add each entry to the index below, newest first.

## Index

| Date | Entry | Status |
|------|-------|--------|
| 2026-10-22 | [Entry error per log](2026-10-22-entry-error.md) | accepted |
| 2026-10-22 | [Every entry of a food shares its error; a bakery class](2026-10-22-same-food-shared.md) | accepted |
| 2026-10-22 | [Sampling CVs from FoodData Central Foundation Foods](2026-10-22-foundation-foods-cvs.md) | accepted |
| 2026-10-22 | [Caffeine: its own wide CV](2026-10-22-caffeine-cv.md) | accepted |
| 2026-10-22 | [Supplements: protein powder CVs from label-accuracy studies; import popup removed](2026-10-22-supplements-evidence.md) | accepted |
| 2026-10-22 | [A supplements category with estimated, tight CVs](2026-10-22-supplements-class.md) | CVs superseded by [supplements-evidence](2026-10-22-supplements-evidence.md) |
| 2026-10-22 | [Sampling CVs scaled by √3 for blended samples](2026-10-22-cv-blend.md) | superseded by [foundation-foods-cvs](2026-10-22-foundation-foods-cvs.md) |
| 2026-10-22 | [Sampling CVs fitted to USDA SR28](2026-10-22-cv-fit.md) | accepted |
| 2026-10-22 | [Error model: distributions, food categories, CIQUAL in the food database](2026-10-22-error-model.md) | accepted; CVs superseded by [cv-fit](2026-10-22-cv-fit.md) |
| 2026-10-22 | [Nutrient variability: plant-food gaps researched and merged](2026-10-22-plant-macros-gaps.md) | accepted |
| 2026-10-22 | [Nutrient variability: one report, "in depth" dropped from the name](2026-10-22-nutrient-report-rename.md) | accepted |
| 2026-10-22 | [Nutrient content variability: full deep research, fact-checked](2026-10-22-nutrient-variability-deep-research.md) | accepted |
| 2026-10-22 | [deep-research-lite skill installed; nutrient-variability research](2026-10-22-deep-research-lite.md) | superseded by [nutrient-report-rename](2026-10-22-nutrient-report-rename.md) |
| 2026-10-22 | [Consumption editor: eaten-up and expired concoctions hidden; "Max" button](2026-10-22-concoction-left-expiry.md) | accepted |
| 2026-10-21 | [md2html.sh: compile markdown notes to self-contained HTML](2026-10-21-md2html.md) | accepted |
| 2026-10-21 | [Dashboard: the error range on its own line, in its own colour](2026-10-21-error-range-line.md) | accepted |
| 2026-10-20 | [Recipes whose amount is their components' sum: the error isn't counted twice](2026-10-20-recipe-sum-error.md) | superseded by [error-model](2026-10-22-error-model.md) |
| 2026-10-20 | [Consumptions list: delete button on each entry](2026-10-20-consumption-trash.md) | accepted |
| 2026-10-20 | [Foods list: concoctions last](2026-10-20-foods-concoctions-last.md) | accepted |
| 2026-10-20 | [Consumption info screen, with an energy donut](2026-10-20-consumption-info.md) | accepted |
| 2026-10-20 | [Dashboard: a "last 7 days" window](2026-10-20-last-7-days.md) | accepted |
| 2026-10-20 | [Daily dashboard: tomorrow](2026-10-20-tomorrow.md) | accepted |
| 2026-10-19 | [Consumption editor: old concoctions listed last](2026-10-19-old-concoctions-last.md) | accepted |
| 2026-10-19 | [Food Info tab: components ranked by the breakdown's nutrient](2026-10-19-info-components-by-nutrient.md) | accepted |
| 2026-10-19 | [Food Info tab: energy and macros first](2026-10-19-info-macros-first.md) | accepted |
| 2026-10-18 | [Breakdown: group consumptions so they count as one (named)](2026-10-18-breakdown-groups.md) | accepted |
| 2026-10-18 | [Consumption editor: edit a concoction's components from its consumption](2026-10-18-edit-concoction-consumption.md) | accepted |
| 2026-10-18 | [Weekly calorie correction: each bound solves the 7-day average](2026-10-18-correction-per-bound.md) | superseded by [error-model](2026-10-22-error-model.md) |
| 2026-10-18 | [Food editor: energy and macros per component](2026-10-18-component-macros.md) | accepted |
| 2026-10-18 | [Concoctions: made-at time as a tag, not part of the label](2026-10-18-made-tag.md) | accepted |
| 2026-10-18 | [Consumption editor: add a new concoction and eat it in one go](2026-10-18-consumption-concoction.md) | accepted |
| 2026-10-17 | [Repeated foods ignored; same ID with different values flagged](2026-10-17-duplicate-foods.md) | accepted |
| 2026-10-17 | [Food editor: unit dropdown for components; "Auto" per amount](2026-10-17-component-units-auto-amount.md) | accepted |
| 2026-10-17 | [Nutrients: Omega-3 and Creatine](2026-10-17-omega3-creatine.md) | accepted |
| 2026-10-17 | [Homescreen: mustard screen buttons; Config moved to the top](2026-10-17-home-mustard-config-top.md) | accepted |
| 2026-10-17 | [Food editor: make a new food from a component](2026-10-17-component-new-food.md) | accepted |
| 2026-10-17 | [Homescreen: + buttons beside Consumptions, Foods and Targets](2026-10-17-home-add-buttons.md) | accepted |
| 2026-10-17 | [Weekly/monthly dashboards: per-day averages](2026-10-17-per-day-averages.md) | accepted |
| 2026-10-17 | [Weekly calorie correction](2026-10-17-weekly-calorie-correction.md) | superseded in part by correction-per-bound |
| 2026-10-17 | [Open Food Facts: text search via search-a-licious](2026-10-17-off-search.md) | accepted |
| 2026-10-16 | [Serve script: reach the app from outside the container](2026-10-16-serve-script.md) | accepted |
| 2026-10-16 | [Error maths audit](2026-10-16-error-math-audit.md) | accepted |
| 2026-10-16 | [Food screen: Edit and Info tabs](2026-10-16-food-info.md) | accepted |
| 2026-10-16 | [Amounts in "u" default to an exact count](2026-10-16-count-unit-exact.md) | accepted |
| 2026-10-16 | [Nutrient breakdown, error ranges on the dashboard, view in the URL](2026-10-16-breakdown.md) | accepted |
| 2026-10-16 | [Daily dashboard: day arrows; centred chevrons](2026-10-16-day-arrows.md) | accepted |
| 2026-10-16 | [Daily dashboard: day slider](2026-10-16-day-slider.md) | superseded by day-arrows |
| 2026-10-16 | [Dates shown as YYYY-MM-DD everywhere](2026-10-16-iso-dates.md) | accepted |
| 2026-10-16 | [New food: a second Save at the top](2026-10-16-food-save-top.md) | accepted |
| 2026-10-16 | ["Today" rolls over without a reload](2026-10-16-day-rollover.md) | accepted |
| 2026-10-15 | [Native Android port](2026-10-15-android-port.md) | accepted |
| 2026-10-15 | [Consumption editor: nutrient details drop-down](2026-10-15-consumption-details.md) | accepted |
| 2026-10-15 | [Calorie budget](2026-10-15-calorie-budget.md) | accepted |
| 2026-10-15 | [Users](2026-10-15-users.md) | accepted |
| 2026-10-15 | [Phone-shaped layout, up to 2.5× wide; fixed homescreen buttons](2026-10-15-phone-layout.md) | accepted |
| 2026-10-15 | [Newest first; consumption unit as text with autocomplete](2026-10-15-newest-first-unit-text.md) | accepted |
| 2026-10-15 | [Errors on every amount, worst-case targets, error bars](2026-10-15-error-bars.md) | superseded by [error-model](2026-10-22-error-model.md) |
| 2026-10-15 | [External food databases: CIQUAL and Open Food Facts](2026-10-15-external-databases.md) | accepted |
| 2026-10-15 | [Targets screen](2026-10-15-targets.md) | accepted |
| 2026-10-15 | [Rename: Logs → Consumptions](2026-10-15-consumptions-rename.md) | accepted |
| 2026-10-15 | [Foods: one list, units per food](2026-10-15-foods.md) | accepted |
| 2026-10-15 | [UI feedback round 1](2026-10-15-ui-feedback-round-1.md) | accepted |
| 2026-10-15 | [Unified items](2026-10-15-unified-items.md) | accepted |
| 2026-10-15 | [MVP scaffold: food tracker PWA](2026-10-15-mvp-scaffold.md) | accepted (data model superseded by unified-items) |
