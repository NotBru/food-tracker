# log-food skill: recognise a photo before asking; few questions for a simple one

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen: backup)
- **Builds on:** [one question per item](2026-10-31-log-food-one-question.md), [log-food photos](2026-10-29-log-food-photos.md)

## Context

One temp note, one photo: a coffee and a medialuna on Edison's plates, the day after an Edison Capu Kinder was
logged. The skill's photo rules (name every ingredient and ask, ask what the photo can't show, close with a
reconstruction) produced 8 questions. User: "it's a Capu Kinder with a medialuna. You shouldn't be so dense for a
single picture. Correct the skill."

## Decision

Photos (SKILL.md), two rules ahead of the rest:
- Recognise before asking: same plates, cups or place as a past entry = that place and the usual order there; local
  names (medialuna); what's recognised is logged as it; what the photo doesn't show wasn't there.
- Proportionate: a single photo of a simple, recognisable meal gets 0–2 questions (only >~50 kcal and unsettled by
  photo and history); assumptions go in the summary table for correction. The full photo procedure is for many
  photos, mixed dishes or unfamiliar food; the closing reconstruction only for several photos or meals.

## Alternatives considered

- **Keep asking, fewer items**: still asks what the history answers.

## Consequences

Simple photos are logged in one pass; a wrong recognition is fixed by a correction batch after the summary. The
skill lives in `.claude/` (not tracked in git), so only this entry is committed.
