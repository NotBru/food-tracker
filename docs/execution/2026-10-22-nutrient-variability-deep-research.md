# Nutrient content variability: full deep research, fact-checked

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** none — user request in chat: "launch a deep-research … ensure individual papers have also
  been fact-checked" (follow-up to [2026-10-22-deep-research-lite.md](2026-10-22-deep-research-lite.md))

## Decision

- Full deep-research run (6 research threads + report writer), building on the lite report. Output:
  `docs/notes/reports/Nutrient content variability in depth.md`, notes and fact-check tables under
  `docs/notes/research_notes/Nutrient content variability in depth/`.
- One thread computed per-nutrient CVs from USDA SR28 (SE·√n / mean). Summary CSVs and scripts are committed;
  the ~98 MB raw download (`data/raw/`) is git-ignored and can be re-fetched from USDA.
- Fact-check: five independent checkers re-opened every cited primary source (160 claims: 126 confirmed,
  13 corrected, 15 overstated → softened, 4 unverifiable and labelled as such). Fixes were applied to the report,
  which ends with a "How this report was checked" section.
- The lite report gets a "superseded" banner instead of being rewritten, noting its one known false claim.

## Consequences

- The report's per-nutrient default CV table is a synthesis judgement, not a published value; it is a starting
  point if the app's error ranges are ever made per-nutrient. Any such change needs an instruction first.
