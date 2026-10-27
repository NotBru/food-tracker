# Backup: change the secret, signed by the old key; deploy and update steps

- **Date:** 2026-10-27
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen; Production)
- **Amends:** [Encrypted backup](2026-10-27-backup.md) (its open question on changing the secret)

## Context

User in chat: "let the old key sign a switch to a new secret and cyphertext. Are instructions updated in the docs
that tell you how to deploy? what happens when I update?"

## Decision

- `POST /backup/<old>/<new>`, body: this device's data encrypted under the new secret. Signed by the old key (it
  owns the backup) and by the new one (`X-New-Signature`, so the key really is the new secret's). Compare-and-swap
  on the old key's version, as an upload. The friend's name and creation date carry over; no new code needed.
- The old key stays as a tombstone (`rotated` in its `keys/<key>.json`, blob deleted): devices still on it get 410
  "This secret was replaced by a new one on another device", on auto-backups (shown on the Backup screen) and on
  restore. The tombstone doesn't point to the new key. `list` shows tombstones as `old`.
- Backup screen: "Change the secret (if it got out)", with a confirm; shows the new secret's QR afterwards. Refused
  while another device's backup is pending (the conflict has to be settled first).
- README Deploy: first-time steps for the backup container (network, `backup` name, volume) and what an update does.
  The earlier line "Beyond `git pull` and a rebuild: nothing so far" was wrong once the backup server existed.

## Alternatives considered

- **Old key only** (no new signature): someone with the old secret could move the backup to a key nobody holds.
  They could already overwrite it, so it's little, but the second signature is cheap.
- **Delete the old key outright**: other devices would just get "unknown key", with no hint why.
- **Tombstone that names the new key**: anyone holding the leaked old secret would learn where the backup went.

## How it was checked

- `npm run build`. Local server and `vite preview`, headless Chromium: A starts a backup, B restores from the link,
  A changes the secret; B's next backup shows the 410 message; C restores with the new secret. `list` shows the old
  key as replaced and the new one under the same name.
- Not checked: the README's `docker` commands (no containers in the devcontainer).
