# log-food skill: no "Claude estimate" tag on foods filled from a label

- **Date:** 2026-11-12
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen: backup)
- **Builds on:** [log-food-estimate-tag](2026-11-06-log-food-estimate-tag.md)

## Context

The user: "Claude should omit the 'Claude estimate' attribute when filling food data from a label."

## Decision

SKILL.md (Picking foods, Tagging estimates): never tag a food filled from a label (a photo of it, or its values
typed in); its values aren't estimates.

## Consequences

The tag stays a suggestion for foods Claude did estimate; label foods look like the user's own in the app.
