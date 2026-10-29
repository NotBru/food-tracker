# log-food skill: body measurements in batches

- **Date:** 2026-10-29
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen: backup)
- **Builds on:** [log-food-sync](2026-10-29-log-food-sync.md), [body-extra](2026-10-24-body-extra.md)

## Context

User in chat: "upload my weight and body fat data (ensure it's as much data as I've been uploading about my
weight)", from a scale's CSV export. The tool only handled foods and consumptions.

## Decision

- Batches take `body`: new measurements (`at`, `values` with the built-in fields, read from `app/src/body.js`),
  changes (`id: "body:…"`, `null` removes a value) and `delete` of `body:` ids. A value given as text gets its ± from
  the digits as the app's form does (`auto`); `{value, delta}` a typed ±. A new row repeating one there is skipped.
  `day` lists the day's measurements with their ids.
- SKILL.md: mirror what the user already records (same fields, same ± per field), and ask when past entries differ.
- Extra (named) measurements aren't covered: none recorded yet.

## How it was checked

Dry runs against the synced copy: an unknown field refused, a repeat of the 2026-10-25 weigh-in skipped, new ones
printed with their ±. The skill lives in `.claude/` (globally git-ignored), so only the docs are committed.
