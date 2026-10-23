# Food editor components: concoctions offered as in the consumption form; "+ add component" scrolls up

- **Date:** 2026-10-23
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen → Made at); request in chat

## Context

The user asked that a new component's "Search foods…" in the food editor follow the same rule for concoctions as the
consumption form. They also asked that "+ add component" leave the page placed so the dropdown is comfortable to
look at while typing. This reverses the "Where" point of
[concoction-left-expiry](2026-10-22-concoction-left-expiry.md) for the food editor's component pickers.

## Decision

- **The rule**: the food editor's component pickers take the same `show` and `oldBefore` as the consumption form.
  Concoctions that are eaten up or expired are left out, and those made before yesterday (logical days) go last.
- **Expired as of what**: the food's "Made at" when it's a concoction, otherwise now. This is the counterpart of the
  consumption's own time.
- **Editing a concoction**: what its own components took is counted back in (`concoctionsLeft`'s new `skipItemId`),
  so a component it finished is still offered.
- The other pickers in the food editor still list everything.
- **Scrolling**: "+ add component" (food editor and consumption form), clicked or pressed, scrolls the new
  component to the top of the view once the on-screen keyboard is up (`pressable`'s `scrollUp`, after 300 ms, as
  with "+ add nutrient"). It jumps with no animation (user's follow-up). The dropdown (up to 260 px) then opens below it in the visible part. A `scroll-margin-top`
  keeps the row clear of the sticky top bar.

## Alternatives considered

- **Scroll to centre** — on a phone with the keyboard up, the list would be cut off under it.

## Consequences

An old batch that's finished can't be picked as a component in the food editor any more. It can still be found in
the Foods list.
