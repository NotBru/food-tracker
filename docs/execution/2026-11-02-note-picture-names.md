# Temp notes: pictures keep their filenames

- **Date:** 2026-11-02
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Temp notes screen); request in chat

## Context

The user asked that temp notes' pictures be stored with their filenames. They weren't: a picked file was shrunk to a
JPEG Blob ([temp-notes](2026-11-02-temp-notes.md)) and only a random file id was kept, so the original name (which on
a phone's gallery often holds when the photo was taken, e.g. `IMG_20261102_131500.jpg`) was lost.

## Decision

- Notes get `pictureNames: { [file id]: name }`, the picked file's `name` as the browser gives it, beside
  `pictures: [file id]`. Synced with the note (it's in the row); the encrypted files on the server are unchanged.
- The app shows it as the picture's tooltip/alt text. The skill's `notes` prints it after each picture's path.
- A picture with no name (notes made before this) just has no entry.

## Alternatives considered

- **`pictures: [{id, name}]`**: tidier, but changes the shape every reader of `pictures` relies on (sync of files,
  cleanup, the skill), needs a Dexie upgrade and a new export format, and notes already synced today would need
  converting on every path in. A map beside it is additive: older copies of the app still read the notes.
- **The name inside the encrypted file**: only readable after fetching the picture, and changes the file format.
- **Naming the skill's saved files after it**: names can repeat and carry odd characters; the id stays the file name
  and the original name is printed.

## Consequences

- An older copy of the app that edits a note saves it without `pictureNames` (it rebuilds the row): the names are lost
  for that note. Notes last a week, so this is minor.
- Camera shots get whatever name the browser invents (often a timestamp or `image.jpg`).
