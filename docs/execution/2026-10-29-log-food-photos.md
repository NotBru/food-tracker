# log-food skill: photos grouped into meals, ingredients confirmed, a closing reconstruction

- **Date:** 2026-10-29
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen: backup)
- **Builds on:** [log-food](2026-10-27-log-food.md)

## Context

User in chat, handing over photos plus notes: "there are more than one picture pertaining the same sandwich, or a
burrito (which was eating for lunch and dinner). The burrito has many pictures for you to recognize ingredients, too.
Does the skill have the instructions necessary for you to be thorough enough with questions that these things are
*asked* just in case?" It didn't: SKILL.md assumed a text dump.

## Decision

A **Photos** section in SKILL.md (under Asking):

- Look at every photo and video (frames about every second), times from file names or metadata.
- Group them into eating occasions and say which photos went together; ask, where not certain, whether several photos
  are one serving or several, how a dish was split across meals, and whether a photo or note without a match is its
  own meal.
- Name the ingredients seen, with how sure, for the user to confirm; read labels and scales in the photos.
- Ask what photos can't show: fillings, spreads, cooking fat, sauces, drinks' contents, what was left or shared.
- Close with the whole reconstruction, meal by meal, as a last question round (not a confirmation to push, which
  stays automatic).

Also under Asking: ask what you're only fairly sure of when it matters, and ask about notation you can't read for
certain rather than guess.

Then, after a first round of 29 questions in one message, user: "Change the script to ask the questions in batches.
No more than 10 questions per answer, and iterate until you've asked all." Asking (SKILL.md) now goes in numbered
batches of at most 10 per message, in time order, each with a best guess, the next batch after the answers;
AskUserQuestion only for up to 4 short ones with options.

Then, on "vacío" (beef, while the user's own foods had a pork vacío): "Can we correct the skill in such a way that
you'd asked to be sure?" Asking (SKILL.md, what exactly) now asks the animal and cut whenever a meat name fits more
than one, even when an own food or past entry suggests one: a past match is a guess to confirm.

## Alternatives considered

- **Leave it to judgment**: the general "ask until you'd defend it" rule let a confident wrong grouping (two photos
  read as two servings) go unasked; the user wants these asked just in case.

## Consequences

More question rounds per dump with photos. The skill lives in `.claude/` (not tracked in git), so only this entry is
committed.
