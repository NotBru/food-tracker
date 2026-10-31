# log-food skill: one question per item, each with a default

- **Date:** 2026-10-31
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen: backup)
- **Builds on:** [log-food photos](2026-10-29-log-food-photos.md)

## Context

User in chat: "modify the skill so that you ask only one question per item, with a reasonable default. It doesn't
matter if that makes you ask more questions." Numbered items had grown into several questions each.

## Decision

Asking (SKILL.md): each numbered item asks one thing, about one food or meal, with its default stated so "yes"
answers it; bundled questions are split into separate items. Batches stay at most 10 per message, so there are more
rounds.

## Alternatives considered

- **Raise the per-message limit** to keep the round count: the user set 10 per message; more rounds are fine.

## Consequences

More rounds per dump. The skill lives in `.claude/` (not tracked in git), so only this entry is committed.
