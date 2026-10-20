# Food editor: make a new food from a component

- **Date:** 2026-10-17
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen → Components); request in chat

## Context

The user asked (in chat) for a way to add new foods recursively while editing a food's components: a +
next to a component's "Search foods…" box. It opens a new food, and saving it goes back to the
original food with that component filled in and its amount left to fill.

## Decision

- `ItemPicker` takes an optional `onCreate(text)`. With it, a round + appears beside the box, and
  what's typed in the box is passed to it. The + keeps the box from blurring on mousedown so the
  typed text is still there. Only the food editor's components use it; consumptions don't.
- When + is tapped, the food form is pushed onto an in-memory stack (`parents` in `Foods.jsx`): its
  hash, name, form state, the shown extra nutrients and the component's index. The new food then
  opens at `#/foods/new?in=<depth>&name=<typed text>`. `in` makes the hash differ from a parent
  that is itself `#/foods/new`, and it keys the form so React remounts it. The subtitle reads
  "component of <parent>", and the name starts as the typed text.
- When the new food is saved, its id is recorded on the stack's top entry and it goes back. The
  parent sees that its hash matches the top entry and restores its form, with the new food set on
  that component. The unit comes from the new food (or stays as the row had it), the amount stays
  blank, and the cursor goes to the amount field.
- Backing out without saving restores the parent with that component still empty.
- It nests: each level pushes its own entry. A child can also go through "Search external" and back
  as usual.
- Making the switch visible (added after user feedback: with nothing typed, the new food looked exactly
  like the parent, so it seemed the component had been deleted). The nested food is titled
  **New component**, with the subtitle **for “<parent name>”** (or "for the new food"). The form also
  slides in from the right when going in and from the left when coming back, with no animation under
  `prefers-reduced-motion`. `body` clips horizontal overflow so the slide can't add a scrollbar.
- The entry comes off the stack in an effect, not in the `useState` initializer, because StrictMode
  runs state initializers twice.

## Alternatives considered

- **New food as a sheet inside the parent form.** That would avoid the stack, but it would mean a
  second, nested copy of the whole food form (its own external search, units, components…), and
  nesting deeper would stack sheets.
- **Stash in sessionStorage.** That would survive a reload, but the in-memory external draft already
  doesn't, and a stale entry left in storage could later restore into an unrelated new food.

## Consequences

- A reload while a child is open drops the stash. The parent's unsaved edits are lost, the same as
  they would be with a reload anyway.
- Web app only. The Android port doesn't have it.
