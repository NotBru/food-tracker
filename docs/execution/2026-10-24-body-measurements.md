# Body measurements: weight, body fat, waist (and lean mass from them)

- **Date:** 2026-10-24
- **Status:** accepted
- **Instructions:** none (not in [`docs/instructions/design.md`](../instructions/design.md)); request in chat

## Context

The user: "Have Weight be below Targets, and rename it to “Body measurements”, and add body fat and think about
something else you may wanna add". This builds on [weight](2026-10-24-weight.md).

## Decision

- **Renamed** to "Body measurements": the screen (`/body`, `Body.jsx`), the Home button and `body.js` (was
  `weight.js`). The table keeps its name, `weights`, to avoid a migration that only renames.
- **Home menu:** Body measurements has its own row, right below Targets. On a phone: Consumptions | Foods, then
  Targets, then Body measurements. On a tall phone: one per row. Wide: three in a row, Body measurements under Targets.
- **An entry** holds any of weight (kg), **body fat (%)** and **waist (cm)**, at least one, and a time. A new entry's
  fields start blank, each showing the last value as a hint. Prefilled values would get saved stale, e.g. a body fat
  that wasn't measured that day. Enter moves to the next field and saves on the last. A cleared field is removed.
- **Added beyond body fat:**
  - **Waist.** A tape measure tracks belly fat directly. It isn't moved by water and food in the gut, or by the
    electrical swings that throw off a home scale's body fat. The field's hint says how to measure it the same
    way each time (at the navel, relaxed, breathing out).
  - **Lean mass**, computed as weight × (1 − body fat), for entries with both. It's what shows whether a cut is
    costing muscle. It's derived, not typed.
- **7-day averages** of each measure on the screen. **Time graphs:** a chart for each measure ever taken (weight,
  body fat, lean mass, waist), after Calories, drawn as the weight chart was. Each scale is fitted to its values,
  at least 2 kg, 2 % or 4 cm tall.
- The maintenance estimate is unchanged: it uses weight only.

## Alternatives considered

- **Hip, chest, arms and thighs.** More fields than this question needs. Waist alone is the strongest single
  indicator of body fat.
- **Rename the table to `measurements`.** That needs a migration and changes the export, for a name only code sees.

## Consequences

- The Android port has none of this.
