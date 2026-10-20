# Breakdown: group consumptions so they count as one

- **Date:** 2026-10-18
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen); request in chat

## Context

User: "In the nutrient inspection window … I wanna be able to group stuff so that it counts as one. Have a
tickbox that selects the stuff, and a button to make a group. This group should be only for the specific log
entries."

## Decision

- **Storage:** a group is a `groupId` string on each member consumption (`logs.groupId`). It belongs to those
  log entries only, not to the foods. No schema change, because the field isn't indexed. Exports and imports
  carry it as is, and editing a consumption keeps it (`db.logs.update` merges).
  - Ids are `Date.now()` plus random base-36 digits, not `crypto.randomUUID()`, which needs a secure context
    (the app is also served over plain http, see [serve script](2026-10-16-serve-script.md)).
- **Breakdown screen** (`groupRows()` in `Breakdown.jsx`):
  - Each row has a tickbox. Ticking anything shows a sticky bar ("N selected · Clear · Group"). Group needs
    at least 2 entries.
  - A group is **one row**: names joined with " + ", value and Δ summed (Δs add linearly, like the screen's
    total), "Group of N · first–last time". It is ranked, and cut into quintiles, as a single entry. The
    quintile headings now count "entries" instead of "consumptions".
  - Tapping a group expands its members (each still opens its food) and an **Ungroup** link.
  - Groups apply in **every** nutrient's breakdown, since they are stored on the consumptions.
  - Ticking an existing group together with other rows merges them into one new group. This covers all of
    that group's members, including any outside the window shown or without this nutrient.
- Members outside the window, or without this nutrient, are simply left out of the row's sum.
- Not shown anywhere else (Consumptions screen, dashboard totals); nothing else changes.

## Alternatives considered

- **A separate `groups` table with member ids.** It would need a schema bump and export changes, and could be
  left pointing at deleted consumptions. A field on the log entry can't.
- **Named groups.** Left out at first; added in the update below.

## Consequences

- Web app only. The Android port doesn't show groups. Whether it keeps `groupId` through its own
  import/export is unchecked.

## Verification

Headless Chromium, 5 consumptions (Rice 300, Chicken 250, Sauce 80, Apple 60, Coffee 5 kcal, Δ 5 each):
- Ticking Rice, Chicken and Sauce left the screen in place, and the bar showed "3 selected". Group gave
  "Rice + Chicken + Sauce 630 ±15 · 91%, Group of 3 · 13:00–13:02".
- Quintiles: Q1 630 (1 entry), Q2 60, Q3 5.
- Proteins breakdown showed the same group.
- Ungroup restored the 5 separate rows.
- No console errors.

## Update: group names; members sorted

User: "Groups should be able to have a name. And the elements within a group should be sorted by the
macronutrient amount as well."
- **Name:** an optional `groupName` on each member consumption, like `groupId`.
  - The selection bar has a "Name (optional)" box above the count and buttons; Enter also groups.
  - An expanded group starts with a name box. It saves on Enter or when you leave the box; emptying it goes
    back to the joined food names.
  - A named group's row shows the name, with the food names on the line below.
  - Merging takes the typed name, or else the name of the largest named group ticked.
  - Ungroup removes the name too.
- **Members sorted** by this nutrient's amount, largest first, just like the outer list. They were in log
  order before.
- **Verified** (headless Chromium, Coffee raised to 95 kcal so log order and amount order differ):
  - Sauce, Apple, Coffee grouped as "Snacks" listed Coffee 95, Sauce 80, Apple 60.
  - Renaming to "Small bits" survived a reload.
  - Merging with Rice kept "Small bits" and listed Rice, Coffee, Sauce, Apple.
  - Clearing the name showed "Rice + Coffee + Sauce + Apple".
  - No console errors.
