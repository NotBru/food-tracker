# Caffeine: its own wide CV

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); model from [`docs/notes/error-handling.md`](../notes/error-handling.md)

## Context

The user's moka coffee has caffeine 176 mg/100 g, typed ±51 as an estimate. Nutrient Δ inputs are no longer used, and
caffeine shared the "other" kind, fitted on 16 SR28 records (beverages: 8.5% after √3).

## Decision

Caffeine is its own kind with an estimated CV of 30% in every category but supplements (5%). Moka coffee measured
128–540 mg/100 mL across coffees and brews (Angeloni et al. 2019, Food Res Int); no study gave a CV.

## Consequences

- Café 100 g: 176 mg caffeine, 104–273 at 90%.
- "other" now only holds creatine outside supplements, still with the CV fitted on caffeine records.
