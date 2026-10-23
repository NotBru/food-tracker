# Consumption editor: eaten-up and expired concoctions hidden; "Max" button

- **Date:** 2026-10-22
- **Status:** accepted; "Where", for the food editor's components, superseded by [food-editor-components-criterion](2026-10-23-food-editor-components-criterion.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen → Made at); request in chat

## Context

The user asked that the consumption editor's food picker leave out concoctions that are eaten up, and those past
an expiration time (a duration, a week by default). They also wanted a "max" button once a concoction is picked.
They asked for this to apply to existing databases automatically.

## Decision

- **What's left** (`concoctionsLeft` in `calc.js`) is the concoction's amount (`baseAmount`, so 1 portion if it has
  none) minus what was taken from it, converted to its unit with the usual unit conversions. Taken from it:
  - every consumption of it, from **every user**, since users share foods and a pot has one amount;
  - every other concoction it is a component of. Recipes don't count, because they're templates, not batches.

  Nominal values only. An amount in a unit that doesn't convert is skipped, because what it took can't be known. It
  counts as eaten up at ≤ 0, allowing for float rounding.
- **Expiry**: an optional `expiresAfterDays` on the food, in days (decimals allowed, so 0.5 = 12 h). If it's not set,
  `DEFAULT_EXPIRY_DAYS` = 7 applies. It is edited under "Made at" in the food editor and in the consumption editor's
  concoction section. Leaving it blank removes the field, so the default applies again.
- **Old databases and old exports**: the default is read at use time, not stored. Every concoction without the field
  expires a week after it was made, with no schema version or migration. Eaten-up is worked out from the
  consumptions already there, so it also works on old data. Foods that become concoctions later get the default too.
- **Where**: both pickers in the consumption editor (the food eaten, and a new concoction's components), as with
  `oldBefore`. `ItemPicker` takes a `show(item)` filter. The Foods list and the food editor's pickers still list
  everything, so an old batch can still be found and edited.
- **Expired as of what**: the consumption's own time, not now. Logging a past meal still offers the soup that was
  fresh then. This differs from `oldBefore`, which counts from today: that rule only sorts the list, while this one
  hides foods.
- **Editing a consumption**: what it took is counted back in. The concoction it finished is still offered, and
  "Max" shows what it could be.
- **Max**: shown under the amount when the picked food is a concoction with some left. It sets the amount to what's
  left (6 significant digits), in the concoction's unit, with Δ = 0. This matches "all of it" when a concoction is
  added from this screen: the error stays in the concoction's own amount.

## Alternatives considered

- **Store `expiresAfterDays: 7` on every concoction through a migration (v13).** Old exports would need the same
  step in `importAll`, and a food made into a concoction later would miss it. Reading a default covers all of these.
- **Hide them at today's date.** Not done, so that backdated logging keeps working (see above).
- **Count only the current user's consumptions.** A shared pot would look full to everyone else.

## Consequences

- Each time the editor opens it reads every consumption (`db.logs.toArray()`). That's cheap at a personal log's size.
- There is no "never expires" option. A long expiry (e.g. 3650 days) does the same.
- Web app only. The Android port has no expiry and doesn't hide anything. Port it when the app is next touched.
