# Open Food Facts: text search via search-a-licious

- **Date:** 2026-10-17
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (V2 external databases; user in chat: "Fix Open Food Facts. It's not working")
- **Amends:** [External food databases](2026-10-15-external-databases.md)

## Context

Text search failed. `cgi/search.pl` (and `/api/v2/search`) mostly answer **503 "Page temporarily
unavailable"** (2 of 3 tries on 2026-10-17); that HTML page has no CORS header, so the browser only
sees a network error. Barcode lookups (`/api/v2/product/…`) still work and allow any origin.

OFF's current search service, search-a-licious (`search.openfoodfacts.org/search?q=…`), answers
reliably but sends **no `Access-Control-Allow-Origin`** for any origin, so a browser can't call it directly.
Its hits carry name, brands (as an array), quantity and the main `_100g` nutriments, but not
`serving_quantity` / `product_quantity` or most micronutrients.

## Decision

- `vite.config.js` proxies `/off-search/*` → `https://search.openfoodfacts.org/*` for both `dev`
  and `preview`. `searchOff` queries it; if it's missing (non-JSON answer from a static host), it falls back
  to `cgi/search.pl`. A 503 now gets a readable message.
- Picking a search hit reads the full product (`offProductDraft`, one product read, within the
  15/min limit) so the draft gets serving/package units and all nutrients; if that read fails it
  uses the hit as is.
- `offDraft` accepts `brands` as a string or an array.
- Barcodes may be typed with the spaces/dashes they are printed with ("3 017620 422003"); they are
  stripped. The digit printed left of the bars is part of the EAN-13: without it OFF pads with a 0 and finds
  nothing ("017620422003" → not found), so the placeholder says "all digits". Leading zeros of UPC codes are
  optional (OFF pads them itself).

## Alternatives considered

- **Retry `search.pl`** — it's failing most of the time, not just occasionally.
- **Read each hit's full product while listing** — 24 reads per search would hit the 15/min product limit.
- **A public CORS proxy** — sends the user's queries to another third party.

## Consequences

- Text search needs the app to be served by Vite (`serve.sh`, `npm run dev`/`preview`); a plain
  static host falls back to the flaky legacy endpoint.
- The **Android port** (`android/.../data/External.kt`) still calls `cgi/search.pl`; it has no CORS
  limit and could call search-a-licious directly. Not changed yet.
