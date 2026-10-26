# Android port removed: web app only

- **Date:** 2026-10-26
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Stack)

## Decision

- User's request: web app only for now, to save tokens. `android/` is deleted (its build outputs too); the
  README and the instructions no longer mention it.
- It's in git history up to `380a9cc` (`git checkout 380a9cc -- android`) if it comes back. It was a port as of
  2026-10-15 and lagged far behind the web app.
- Not touched: the Android SDK at `~/android-sdk` (outside the repo), and older entries' mentions of the port,
  which stay as history.
