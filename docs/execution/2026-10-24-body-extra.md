# Body measurements: other measurements named per entry, like attributes, with a name lookup

- **Date:** 2026-10-24
- **Status:** accepted
- **Instructions:** none (not in [`docs/instructions/design.md`](../instructions/design.md)); request in chat

## Context

[body-errors](2026-10-24-body-errors.md) made user fields shared definitions, managed behind a ⚙️. The user: "Oh
no; I wanted it to work the same way attributes work. Plus a lookup on the measurement as you're writing it to
ensure no fields get a typoed repetition".

## Decision

- **Per entry, like a food's attributes.** Under the built-in fields, the entry sheet has "+ measurement". Each one
  is a row: name | unit | value | ± Δ | ×. It's stored on the entry as
  `extra: [{label, unit, value, text, delta, auto}]` (Δ as everywhere: blank means from the digits). The ⚙️ and
  the Fields sheet are gone.
- **The same measurement:** names equal once case, accents and spacing are ignored (`body.js nameKey`). Its
  charts and 7-day averages take every entry that has it. The name shown is the first spelling used, and the unit
  the latest one given.
- **Lookup while typing:** the name box lists the names used before (any user's) that contain what's typed, and
  then one it looks like a typo of, marked "did you mean". Picking one takes its spelling, and its unit if the unit
  is blank.
- **Typo check on save:** a name that isn't known but is close to a known one asks "“Nekc” looks like “Neck”. Use
  “Neck”?". OK takes the known name (and its unit if blank); Cancel keeps it as a new measurement.
  - "Close" means 1 edit for names of up to 5 letters, otherwise 2 (swapped neighbours count as one edit).
  - Names that are equal once everything but letters is dropped also count ("Neck2").
  - A known name typed with different case or accents is saved with the known spelling, silently.
  - The same name twice in one entry is refused.
- **Data:** db v15 moves values of the shared fields (config `bodyFields`) into each entry's `extra` and drops the
  config row. Imports do the same (`fieldsToExtra`).

## Alternatives considered

- **Refuse lookalike names.** Some are genuinely different ("Hip" and "Hips" could be meant apart), so it asks.
- **Ask only through the dropdown.** It's easy to miss on a phone; the check at save catches what it didn't.

## Consequences

- The Android port has none of this.
