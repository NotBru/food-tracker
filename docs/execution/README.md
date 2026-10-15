# Execution log

Written by Claude (and other agents) while doing the work. Records *how* the
instructions in `docs/instructions/` were carried out and *why* choices were made.
Humans read and may comment, but direction belongs in `docs/instructions/`.

## What goes here

- Design decisions and the alternatives considered
- Assumptions made where instructions were silent or ambiguous
- Open questions for humans
- Notable deviations from instructions, with justification

## Conventions

- One file per decision or work session: `YYYY-MM-DD-short-slug.md`
  (e.g. `2026-10-15-database-choice.md`). Copy `_template.md` to start.
- Entries are append-only in spirit: if a decision is reversed, write a new entry and
  set the old one's status to `superseded by <file>` rather than rewriting history.
- Always link the instruction file(s) the entry serves.
- Add each entry to the index below, newest first.

## Index

| Date | Entry | Status |
|------|-------|--------|
| 2026-10-15 | [Phone-shaped layout, up to 2.5× wide; fixed homescreen buttons](2026-10-15-phone-layout.md) | accepted |
| 2026-10-15 | [Newest first; consumption unit as text with autocomplete](2026-10-15-newest-first-unit-text.md) | accepted |
| 2026-10-15 | [Errors on every amount, worst-case targets, error bars](2026-10-15-error-bars.md) | accepted |
| 2026-10-15 | [External food databases: CIQUAL and Open Food Facts](2026-10-15-external-databases.md) | accepted |
| 2026-10-15 | [Targets screen](2026-10-15-targets.md) | accepted |
| 2026-10-15 | [Rename: Logs → Consumptions](2026-10-15-consumptions-rename.md) | accepted |
| 2026-10-15 | [Foods: one list, units per food](2026-10-15-foods.md) | accepted |
| 2026-10-15 | [UI feedback round 1](2026-10-15-ui-feedback-round-1.md) | accepted |
| 2026-10-15 | [Unified items](2026-10-15-unified-items.md) | accepted |
| 2026-10-15 | [MVP scaffold: food tracker PWA](2026-10-15-mvp-scaffold.md) | accepted (data model superseded by unified-items) |
