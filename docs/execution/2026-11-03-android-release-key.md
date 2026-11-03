# Android app: its own release key; versions bumped at each port

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Stack: Android app)

## Context

Toward updates through an F-Droid repo on the VPS (proposed in chat), two prerequisites: F-Droid offers an update
only for a higher `versionCode`, and updates need one key that outlives the container (the debug key in
`~/.android/` goes with a container rebuild). The user chose a manual bump per port ("incremental patches").

## Decision

- Each port bumps `versionName`'s patch and `versionCode` by one (README, Re-porting); this one: 0.2.1, code 3.
- Release key: RSA 4096, 100 years, PKCS12, `.secrets/android-release.p12` (git-ignored, on the mounted workspace so
  it survives the container), passwords in `.secrets/android-release.properties`. SHA-256
  `44:62:FA:49:58:06:01:01:03:C0:9B:4D:07:C5:8C:59:26:C7:6F:3C:DE:2A:3A:55:ED:BF:62:33:E2:F5:66:73`.
- No key file: the release APK is left unsigned rather than signed with the debug key, so a wrong key can't slip
  onto the phone unnoticed.

## Alternatives considered

- **versionCode from the build time or commit count** — automatic, but the user preferred a bump per port.
- **Keep the debug key, backed up** — works, but it's shared by every debug build of anything on this machine.

## Consequences

- Moving from 0.2.0 (debug key) to 0.2.1 means one uninstall; the data comes back from the backup.
- The key and its passwords must be copied off the laptop; losing them means another uninstall.

## Open questions

- The F-Droid repo itself (its own index-signing key, a Caddy route, a publish script): not started.
