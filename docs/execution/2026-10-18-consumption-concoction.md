# Consumption editor: add a new concoction and eat it in one go

- **Date:** 2026-10-18
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Consumptions screen; Foods screen → Made at, Components); request in chat

## Context

The user asked (in chat) for a checkbox in "add consumption" that turns the sheet into an "add concoction"
page, without the nutrients section and with an automatic amount. Hitting Add should create the concoction
and also register the consumption of it.

## Decision

- **Checkbox "New concoction (made at this time)".** It only appears on new consumptions; editing an existing
  one is unchanged. When ticked, the Item picker is replaced by **Name**, **Brand**, **Attributes** and a **Components** list. The list
  uses the same rows as the food editor: food search, amount, ± Δ, and a unit autocomplete. Below it, a line
  shows the total. The Save button reads **Add**.
- **Made at = the consumption's date and time.** One field covers both, since the usual case is "made it,
  ate it".
- **Automatic amount.** The concoction's per amount is the sum of its components, worked out as the food
  editor's Auto does it (`componentsTotal`, rounded to 6/3 significant digits, Δ stored explicitly). The sum
  is in g if every component converts to g, otherwise ml, otherwise the first component's unit (e.g. eggs
  counted in u).
- **No nutrients section.** The nutrients are inferred from the components, as for any food that has
  components. The consumption's own macro line and Details drop-down still show, computed from the unsaved
  concoction (it is put into the context under a placeholder id, like the food editor's live preview).
- **Amount eaten: blank = all of it.** The placeholder reads "all". A blank amount records the concoction's
  own amount and unit with Δ 0, so the consumption's nutrients are exactly the components' sum and no error
  is added twice. A typed amount works as usual, with its unit defaulting to the concoction's.
- **One transaction.** The food and the consumption are written together, so a failure can't leave a
  concoction with no consumption.
- **Name, Brand and Attributes**, as in the food editor (attributes are part of a food's ID). At first only
  a name was asked for. The user then asked for brand and attributes too (in chat, same day).

## Alternatives considered

- **Open the full food editor from the sheet and come back** (like "new component"). That would bring back
  the nutrients section and the extra steps the user wanted to skip.
- **Prefill the amount eaten with the total.** That would go stale as components are edited. "Blank = all"
  always matches the total.

## Consequences

- There's no "+ new food" beside a component's search here. The sheet is a modal, so the food editor's
  navigation stack doesn't apply. Foods have to exist already.
- Web app only. The Android port doesn't have it.
