# log-food skill: the "database: Claude estimate" tag a suggestion, not added by the tool

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen: backup)
- **Builds on:** [log-food](2026-10-27-log-food.md)

## Context

`food.mjs push` gave every new food the attribute `database: Claude estimate`, even with `attributes` in the batch
(it appended it). Logging Gula's Hamburguesa Francesa, the user wanted it left out, and then: "Add the 'database:
Claude estimate' as a suggestion for the skill, not enforced by the tool."

## Decision

- `food.mjs`: new foods start with no attributes; a batch's `attributes` are taken as given.
- SKILL.md (Picking foods): a food or recipe Claude estimated *may* carry `"attributes": [["database", "Claude
  estimate"]]`; left out when the user says so. The batch-format note no longer says the tool adds it.

## Alternatives considered

- **A flag to opt out** (`"tag": false`): keeps the tool deciding; the user asked for the skill to.

## Consequences

Foods pushed without the attribute look like the user's own in the app; whether to tag is Claude's call per batch.
