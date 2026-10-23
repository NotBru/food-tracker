# Dropdowns: a search box on a computer, native on a phone

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md)

## Context

The user asked to tell a phone from a computer and, on a computer, give every dropdown a text box that matches
results, as the food and unit pickers do. The dropdowns were the food's category (Food editor) and the "per" unit
(Food info).

## Decision

- Computer = the main pointer is precise, `matchMedia('(pointer: fine)')` (`useComputer`, follows changes). A
  touchscreen laptop counts as a computer, a tablet as a phone.
- `Select` (components.jsx): on a phone, the native `<select>` (with optgroups); on a computer, a text box showing the
  choice that lists every option on focus, the current one highlighted. Typing filters as the other pickers do (every
  word, accents ignored); the group's name counts, so "beverages" lists the beverage subgroups. ↑/↓/Enter pick; Esc
  or leaving keeps the choice. Options carry their group as a muted suffix ("cheese and similar · Milk and milk
  products").
- Both dropdowns use it. In Food info's "per" row the list floats over the content instead of pushing the row.
- Food editor (user's follow-up): picking with Enter in the category, a component's food or its unit moves the
  cursor to the next text box, dropdown or text area on the screen (`enterNext`, `focusNextField`); none left: the box
  just closes. A click still only closes the list. The consumption form likewise (the food or a concoction
  component's food → its amount; a unit → the next box), and its "+ add component" row is reached with Tab.
- Food editor, a component's row: Enter in any of its boxes (amount, ± Δ, unit after picking, ε) goes to "+ add
  component", so a recipe is typed as food, Enter, amount, Enter, Enter, next food. The ε box selects its value on
  opening, so typing replaces it. The consumption form's concoction components likewise (user's follow-up).
- The food editor's "+ add unit" and "+ add component" rows are reached with Tab (`pressable`: a button role, Enter
  or Space presses it); pressed from the keyboard, the cursor goes to the new row's first box. "+ attribute" too
  (to the new attribute's key). Focus shows as an
  accent border.
- "+ add component" (food editor and consumption form), clicked too, puts the cursor in the new component's "Search
  foods…" box (user's follow-up; `pressable`'s `focusOnClick`).

## Alternatives considered

- **User agent / `userAgentData.mobile`** — brittle (iPadOS reports a Mac; Firefox lacks `userAgentData`); what
  matters here is mouse versus finger.
- **Window width** — a narrow desktop window would lose the search box.
- **Search box on phones too** — the native picker is the better touch control; the user asked for computers only.

## Consequences

New dropdowns should use `Select`. Category names are CIQUAL's English ones, so they match English words only.

## Open questions

None.
