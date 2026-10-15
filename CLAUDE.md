# CLAUDE.md

## Documentation layout

- `docs/instructions/` — **Human-only.** Requirements, goals, constraints and direction written by people.
  - Read these before starting work; they are the source of truth for *what* to build.
  - **Never create, edit, rename or delete anything in this directory.** If an instruction looks wrong,
    ambiguous or outdated, say so in chat or record it in an execution log — do not "fix" it.
- `docs/execution/` — **Claude's working log.** Design choices, trade-offs, open questions and progress.
  - Log every non-trivial decision here, following `docs/execution/README.md`.
  - Reference the instruction file(s) each decision serves.
