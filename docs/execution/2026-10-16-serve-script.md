# Serve script: reach the app from outside the container

- **Date:** 2026-10-16 (revised 2026-10-17)
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (user request in chat: serve from
  inside the container, reachable at `localhost:5173` on the host, via a `./` script run at boot; not VS Code)

## Context

Vite already listens on all interfaces, but the devcontainer publishes no ports, and outside
VS Code nothing forwards them. A process inside the container cannot publish a port (no Docker
socket in here), and `.devcontainer/` is mounted read-only inside the container.

## Decision

`./serve.sh` is run from the **host** (user, 2026-10-17: "run it from outside so that it boots the
container"). It (re)creates a dedicated `food-tracker` container from `node:22-bookworm-slim` with the
repo bind-mounted, `-p 127.0.0.1:5173:5173` (`--lan` for `0.0.0.0`), `--restart unless-stopped` so it
comes back whenever Docker starts at boot, running as the host user so repo files stay theirs.
Inside, the same script puts fnm's Node on `PATH` if present, installs deps if missing and runs the
Vite dev server on `0.0.0.0:5173`. Run inside any container it serves in the background
(`--fg`, `--stop`, log `app/serve.log`).

## Alternatives considered

- **Publish the port from the devcontainer** (`appPort` in `devcontainer.json` + rebuild) — needs a
  manual edit of a file that is read-only from inside, and the devcontainer CLI on the host; a separate
  container needs neither.
- **Host-side `socat` forwarding into the devcontainer** (first version) — needs socat on the host and
  re-running after every boot.

## Consequences

- Needs only Docker on the host; first run pulls `node:22-bookworm-slim`.
- `node_modules` is shared with the devcontainer (both glibc Linux, same Node major).
- Dev server, not a production build: hot reload, no service worker (it is only registered in
  production builds).
