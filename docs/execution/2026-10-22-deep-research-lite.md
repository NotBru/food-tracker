# deep-research-lite skill installed; nutrient-variability research

- **Date:** 2026-10-22
- **Status:** superseded by [2026-10-22-nutrient-report-rename.md](2026-10-22-nutrient-report-rename.md)
- **Instructions:** none — user request in chat: install `deep-research-lite/` properly and research how
  much nutrient content (carbs, kcal, vitamins…) varies between samples/providers, and why

## Decision

- The skill was moved from the repo root to `.claude/skills/deep-research-lite/`, the project-level
  skills directory, so Claude Code discovers it in this repo (confirmed: it is now listed as a skill).
- Research output lives under `docs/notes/` instead of the repo root the skill defaults to:
  notes in `docs/notes/research_notes/Nutrient content variability/`, report in
  `docs/notes/reports/Nutrient content variability.md`.

## Alternatives considered

- **User-level `~/.claude/skills/`** — available in every project, but not tied to this repo.
- **Research output at the repo root** (skill default) — clutters the root next to `app/` and `android/`.

## Consequences

- `.claude/` is in the global gitignore (`~/.gitignore_global`), so the skill is not committed;
  it lives only in this checkout unless force-added.
- The report is relevant to the app's error ranges: macros in plant foods are ~±10–20%, fat/energy in
  animal foods and soil/light-driven micronutrients far more, and label/Atwater errors are directional.
  Figures come from search summaries, so check them against the primary papers before encoding any of them.
