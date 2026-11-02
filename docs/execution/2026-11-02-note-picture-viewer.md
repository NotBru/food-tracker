# Temp notes: arrow keys and swipes go through a note's pictures

- **Date:** 2026-11-02
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Temp notes screen); request in chat

## Context

The user asked that left/right keys, and swiping on phones, go through the pictures of one note in the full-screen
view. It showed one picture only ([temp-notes](2026-11-02-temp-notes.md)).

## Decision

- The full-screen view (`Viewer` in `Notes.jsx`) gets the note's pictures and the tapped one's place, from the list
  and from the editor alike (there, the pictures as they are in the editor, unsaved ones included).
- ← and → move by one and stop at the first and last (no wrap-around). They're caught before anything else and their
  default is stopped, so with the editor below they don't also move its text cursor.
- A swipe is a touch that ends 40 px or more sideways and more sideways than up/down: left for the next picture, right
  for the one before, as in phone galleries. The tap a swipe may end in doesn't close the view; a plain tap still
  does.
- With more than one picture, a small "2 / 3" at the bottom shows where you are (otherwise nothing hints there are
  more).

## Alternatives considered

- **Wrap around at the ends**: with a handful of pictures it's easy to lose track of which came first.
- **On-screen ‹ › buttons**: not asked for; keys and swipes cover desktop and phone.

## Consequences

- Escape doesn't close the view (it didn't before either); a click or tap does.
