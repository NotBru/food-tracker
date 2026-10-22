# Breakdown: "Total" or "per 100 kcal"

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard); request in chat

## Context

User: "I want a toggle between 'total {nutrient}' and 'nutrient vs. calories' (rename it so that it's terse) when
looking at a nutrient through the dashboard."

## Decision

- The [breakdown](2026-10-16-breakdown.md) of every nutrient except energy gets a toggle under the header:
  **Total · per 100 kcal**. It is kept in the URL (`&per=kcal`), so Back and the [Days](2026-10-22-last7-days-view.md)
  → day link keep it.
- "vs. calories" read as nutrient density: the nutrient per 100 kcal (e.g. 7.8 g/100 kcal), the usual
  nutrient-density measure. "% of kcal" would only work for the macros.
- With per 100 kcal on:
  - **Header:** the window's total of the nutrient over the calories of *every* consumption in the window, with the
    nutrient or not. That is the diet's density.
  - **Days:** each day's nutrient over that day's calories (every consumption), ranked by that.
  - **Ranked:** each consumption (or group) over its own calories, ranked by that. The share column becomes its
    kcal. Consumptions with 0 kcal (pills) would be infinite, so they're left out and counted in the note at the bottom.
    Their nutrient still counts in the header and the days.
  - **Quintiles** are hidden: they split a total, and ratios don't add up.
- **Error:** both relative errors combined in quadrature, as if independent (`per100()` in `Breakdown.jsx`). A food's
  nutrient and calories can err together, which this ignores, so the interval is approximate. It is probably too wide
  where they err together.

## Verification

Headless Chromium, last 7 days, with chicken, rice, whey, apple and a 0 kcal protein pill:
- Protein header: 71 g total; 7.8 g/100 kcal.
- Days and ranked lists re-ranked by density (whey 20, chicken 18.8, rice 2.1 g/100 kcal). The pill was left out
  and noted.
- A day opened from Days kept per 100 kcal; Total brought Quintiles back.
- Energy has no toggle. No console errors.
