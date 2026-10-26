# CLAUDE.md

## Documentation layout

- `docs/instructions/` — Requirements, goals, constraints and direction: the source of truth for *what* to build.
  - Read these before starting work.
  - Keep them in sync with the app, in their terse form and existing structure, for easy human review.
    Reasoning and detail go in the execution log, not here.
- `docs/execution/` — **Claude's working log.** Design choices, trade-offs, open questions and progress.
  - Log every non-trivial decision here, following `docs/execution/README.md`.
  - Reference the instruction file(s) each decision serves.
