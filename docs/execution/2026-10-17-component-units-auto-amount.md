# Food editor: unit dropdown for components; "Auto" per amount

- **Date:** 2026-10-17
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen → Components, Units); request in chat

## Context

The user asked (in chat) for two things. Component units had no dropdown, unlike a consumption's unit.
They also wanted an "auto" button that fills the food's amount with the sum of its components.

## Decision

- **Component unit dropdown.** Each component's unit now uses `UnitCombo`, the consumption screen's
  autocomplete. It lists the units that component's food converts to (`unitsFor`), with the food's own
  unit first. The field is disabled until a food is picked. When a food is picked, the row keeps its unit
  if that unit still converts, and otherwise switches to the food's own unit (`keepUnit`, as on
  consumptions). Before this change, any typed unit was kept even when it couldn't convert.
- **Auto per amount.** When the food has components, a line under the Per amount row reads
  `Auto  sum of components: 350 ± 30 g`. Tapping **Auto** fills in the amount, its ± Δ and the unit.
  - The sum is in the food's unit, or in g when the unit is blank. Each component is converted with its
    own food's units (`componentsTotal` in `calc.js`).
  - The Δs add up, following the same worst-case interval rule as nutrients, so the errors of the unit
    conversions are included too.
  - The Δ is filled in explicitly. Leaving it blank would derive it from the digits of the sum, which
    would understate the error.
  - Values are rounded to 6 significant digits for the amount and 3 for the Δ, to hide float noise
    such as 0.1 + 0.2.
  - If a component has no amount, or can't be converted to the unit (e.g. eggs in "u" to "portion"),
    the line says which one instead.
- **One-shot.** Auto fills the fields once. It doesn't lock them to the sum: editing the components
  later doesn't change the amount, but the line keeps showing the current sum, so a second tap brings
  it up to date.

## Alternatives considered

- **A stored "amount = sum" flag that keeps the amount in sync.** This adds a new stored field and
  a mode to explain. A recipe's amount is often less than the sum anyway (water boils off), so the user
  usually wants to start from the sum and edit it.

## Consequences

- Web app only. The Android port doesn't have it.
