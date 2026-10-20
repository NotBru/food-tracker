# Foods list: concoctions last

- **Date:** 2026-10-20
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen); request in chat

## Context

User: "When I click food, I want concoctions to go to the bottom, not the top". The Foods list sorted by
made-at time first, so every concoction came before the other foods.

## Decision

- The Foods list (homescreen → Foods) shows ingredients and recipes first, alphabetically, then concoctions,
  newest first.
- The food picker (consumption editor, components) is unchanged: there, recent concoctions first is what makes
  logging a leftover quick, and concoctions made before yesterday already go last
  ([old concoctions last](2026-10-19-old-concoctions-last.md)).
