# Backup server: encrypted only; account mode discarded

- **Date:** 2026-10-26
- **Status:** accepted (direction); built in [backup](2026-10-27-backup.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md)

## Decision

- User's decision: **only the encrypted backup**. The server never holds data it can read. The VPS agent's
  handover proposed two modes: "account mode" (username and password, the server can read the data) and
  "encrypted mode". **Account mode (custodial) is discarded.**
- The secret moves between devices as a scannable QR code (or, failing that, readable plain text), not as a
  memorable password.
- Not started: the user wants the site running first (see [web-image](2026-10-26-web-image.md)).

## Consequences

- The VPS agent's encrypted backups of readable health data on the server are no longer needed. The server's data
  directory only ever holds ciphertext and public keys.
- A random secret moved by QR answers the handover's first caveat (a memorable password can be brute-forced
  offline against the stored public key).

## Open questions

- The handover's encrypted-mode design (HKDF → Ed25519 signing key + AES-GCM key, signed compare-and-swap
  uploads, secret rotation signed by the old key) is proposed, not yet confirmed by the user.
- Does one backup cover the whole device (all local users, shared foods and config) or one local user?
