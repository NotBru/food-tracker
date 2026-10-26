# Server rate-limits its Open Food Facts searches

- **Date:** 2026-10-26
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (V2 external databases; user in chat:
  "Ensure the server rate-limits itself towards Open Food Facts")
- **Amends:** [Production image of the web app](2026-10-26-web-image.md)

## Context

Only text search goes through the server (`/off-search/*` → search.openfoodfacts.org); barcode and product reads go
from each browser straight to OFF, under each user's own IP. So every user's searches share the server's IP, and
OFF allows 10 searches a minute per IP. Caddy has no rate limiting built in.

## Decision

- The production Caddy is built with [caddy-ratelimit](https://github.com/mholt/caddy-ratelimit) (`caddy:2-builder`
  + `xcaddy`, copied into `caddy:2`), and `/off-search/*` has one zone keyed `static`: 10 requests in any sliding
  minute for all clients together. Past it Caddy answers 429 with `Retry-After` and OFF isn't contacted.
- The app's 429 message gives the `Retry-After` wait when there is one.
- A 429 doesn't fall back to the legacy `cgi/search.pl` (that's direct from the browser, but mostly 503 anyway).
- The Vite dev/preview proxy is unchanged: one user, and the browser already only searches on Enter.

## Alternatives considered

- **Per-client limit** (keyed by IP): doesn't bound the total OFF sees from the server.
- **Queueing over-limit requests** instead of 429: holds connections open and hides the wait; the user retrying is
  clearer.
- **nginx `limit_req`** (built in): would mean switching servers for one directive.

## How it was checked

- `npm run build`.
- Not checked: the plugin build and the Caddyfile with it. Docker can't run containers in the devcontainer, and
  running a downloaded plugin-built Caddy binary was refused by the sandbox. First real run is `docker build` on the
  VPS; if `caddy validate` fails there, the `rate_limit` block is the place to look.
