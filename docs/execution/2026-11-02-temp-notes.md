# Temp notes: text and pictures, a week long, synced; read by the log-food skill

- **Date:** 2026-11-02
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen, Temp notes screen, Config screen: Backup); request in chat

## Context

The user asked for "temp notes": text plus pictures (one or many, camera or gallery), stored with the time the note is
made, synced, deleted by the app after a week, and readable by Claude's log-food skill with the backup secret. That
last part is the main reason for them (photos and notes of meals, to log later).

Also in the same request: the Logs group's buttons one per row on wide screens too (they were three in a row there,
[home-groups](2026-11-02-home-groups.md)).

## Decision

- **Pictures are not in the backup's data.** The backup is one encrypted JSON blob, capped at 4 MB on the server and
  uploaded whole after every change. A week of meal photos would pass the cap within days and make every sync
  upload megabytes. Instead:
  - Each picture is a file of its own on the server, `PUT/GET/DELETE /backup/<key>/files/<id>`, signed like every
    request and encrypted with the backup's AES key (`FTF1` + IV + AES-GCM, not gzipped; the id is authenticated
    data, so one file can't be served as another).
  - The server deletes files 10 days after their upload (a sweep as it starts and hourly), so cleanup doesn't depend
    on any device being open. A key holds at most 200 MB of them (`MAX_FILES_BYTES`). A key change drops them; the
    app uploads them again under the new secret.
  - On the device they're in a `files` table (`{id, blob, uploaded}`) outside `TABLES`: not exported, not merged, no
    change hooks.
  - A sync uploads the pictures added here **before** the rows (so a device that gets a note finds its pictures),
    and fetches the missing ones **after**. The 5-second check also fetches missing ones when nothing changed (after a
    restore). A picture the server doesn't have is skipped until the app is reopened.
  - A note deleted (or a picture taken out) here deletes its files on the server right away, best effort.
- **Notes** are a synced table `notes` (Dexie v17): `{id, userId, datetime, text, pictures: [file id]}`, per user like
  consumptions. `datetime` is when the note is saved the first time, and editing keeps it. Export format 9: older apps
  are told to update instead of failing on an unknown table.
- **Expiry**: as the app opens and hourly, notes whose `datetime` is over 7 days old are deleted, and so are local
  pictures no note uses. The deletion syncs like any other.
- **Pictures are shrunk** to 1600 px on the long side, JPEG 85% (EXIF rotation applied): ~40–400 KB instead of a
  camera's several MB, and still enough to read a plate or a label (Claude scales images to about that size anyway).
- **Screen** `/notes` (homescreen: Logs → Temp notes, with +): newest first, the time, days left, the text, thumbnails
  (tap: full screen). The editor has a text box, Camera (`capture="environment"`) and Gallery (`multiple`) buttons,
  and × per picture.
- **Skill**: `food.mjs notes [±HH:MM]` syncs, lists the notes with their times at that offset, and saves the
  decrypted pictures to `.secrets/notes/<id>.jpg` (git-ignored, removed once their note is gone) for Claude to open.
  The tool's uploads now carry the app's current format number.

## Alternatives considered

- **Pictures inside the backup (data URLs)**: simplest, but breaks the 4 MB cap and re-uploads every picture on every
  change.
- **No DELETE, only the server's expiry**: simpler, but a deleted note's pictures would linger encrypted for 10 days.
- **Notes shared by all users**: the skill already works per user, and consumptions are per user.

## Consequences

- The server must be redeployed with the app (new endpoints); until then pictures fail to upload and the sync icon
  turns red.
- Export databases (the JSON file) carries notes but not their pictures.
- A note revived by a merge conflict after another device deleted it may have lost its pictures on the server.

## Open questions

- Should the skill delete notes once it has logged them (`delete: ["note:…"]`)? Not built; raised in chat.
