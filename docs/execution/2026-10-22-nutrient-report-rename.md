# Nutrient variability: one report, "in depth" dropped from the name

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** none — user request in chat: "Rename it to remove 'in depth' and remove the previous one"

## Decision

- The fact-checked report is now `docs/notes/reports/Nutrient content variability.md`.
- The earlier lite report and its notes (`research_notes/Nutrient content variability/`) are removed. They stay
  in git history (commit 6dfdbd4). The full report never cited them; the one pointer to them, in the full run's
  `micronutrients.md`, now names that commit.
- The fact-check tables' report paths were updated to the new name.
- The notes folder `research_notes/Nutrient content variability in depth/` keeps its name for now, because a
  research thread on the plant-macro gaps is writing into it. It will be renamed once that thread is merged.

## Consequences

- Paths in the earlier entries [2026-10-22-deep-research-lite.md](2026-10-22-deep-research-lite.md) and
  [2026-10-22-nutrient-variability-deep-research.md](2026-10-22-nutrient-variability-deep-research.md) are left
  as written (they record what was true then) and no longer resolve.
