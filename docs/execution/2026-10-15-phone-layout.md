# Phone-shaped layout; homescreen with fixed buttons and a scrolling dashboard

- **Date:** 2026-10-15
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen)

## Context

User: "Make it so that the design occupies a ratio decent for a phone. The homescreen buttons should be visible
throughout the scroll, and the dashboard should be scrollable on its own instead."

## Decisions

- **Phone proportions everywhere:**
  - Screens and bottom sheets are at most `clamp(360px, 56dvh, 480px)` wide: about 9:16 of the window's
    height, never narrower than 360 px or wider than 480 px.
  - On a phone this is simply the full width. On a desktop (1400×900) it's a centred 480 px column.
  - On windows ≥ 600 px wide the page around the column is darker and the column gets a 1 px outline, so it
    reads as a phone.
- **Homescreen = exactly one screen tall** (100dvh minus safe areas), as a flex column:
  - the window header (swipe, ‹ ›) stays on top;
  - the dashboard panel takes the remaining height and scrolls on its own (`overscroll-behavior: contain`, so
    reaching its end doesn't scroll the page);
  - the buttons stay pinned at the bottom.
  The page itself never scrolls.
- **Buttons are more compact** to leave the dashboard room: Consumptions/Foods/Targets/Config in a 2×2 grid,
  then Import/Export in one smaller row. Before, they were five full-width rows (about 350 px); now about 170 px.
- Other screens (Consumptions, Foods, Targets, Config) still scroll as a whole, with their sticky top bar.

## Verification

Headless Chromium, three sizes, with 7 targeted nutrients so the dashboard overflows:

| Size | Column width | Page scroll | Dashboard height |
|---|---|---|---|
| Pixel 7 (412×839) | 412 | 0 | 553 px, scrolls inside |
| Desktop (1400×900) | 480, centred | 0 | 614 px, scrolls inside |
| Small phone (360×640) | 360 | 0 | 354 px, scrolls inside |

In all three the buttons ended within 12 px of the bottom edge. No console errors.

## Update: no frame; up to 2.5× wider on large windows

User: "Don't make the outermost rectangle noticeable (just let it blend with the background). Then, depending on
the window size, go as far as 2.5x the width (and then cap it, if the window is bigger)."
- **No frame:** the darker page background and the column outline are removed, so the column blends with the
  page.
- **Width:**
  - Screens are at most `2.5 × --phone` wide, where `--phone = clamp(360px, 56dvh, 480px)` (the phone width
    above). Below that they follow the window.
  - Examples: 1000×700 → 980 px; 1400×900 and 2400×1300 → capped at 1200 px.
  - Bottom sheets (editors) stay one phone wide.
- **Content reflows with the width:**
  - gauges: `auto-fill, minmax(140px, 1fr)`, so 2 columns on a phone and 6–7 on a desktop;
  - bars: `auto-fill, minmax(min(340px, 100%), 1fr)`, so 1 column on a phone and 2–3 when wide;
  - buttons: 2×2, then one row of 4 from 700 px.
- **Buttons are pinned to the bottom** (`margin-top: auto`), including when the dashboard is short and doesn't
  need to scroll.
- **Verification (headless Chromium):**
  - 5 sizes (360×640, 412×839, 1000×700, 1400×900, 2400×1300) × both styles.
  - No page scroll or horizontal overflow; buttons 12 px from the bottom in every case.
  - The page and column backgrounds are the same colour, with no shadow.
  - No console errors.

## Update: stacked buttons (4×1) when the window is tall enough

User: "Make the buttons go to 4x1 if the height is sufficient, instead of 1x4."
- **≥ 800 px tall:** the four buttons stack, one per row at full width, with Import/Export as a row below.
  The 800 px threshold keeps the dashboard at about 400 px or more.
- **Shorter windows** keep the earlier layouts: 2×2 when narrow, one row of 4 from 700 px wide.
- **Verification:**
  - Stacked: Pixel 7 (412×839, dashboard ≈ 430 px), 1400×900, 2400×1300, 800×1200.
  - 2×2 at 360×640; one row of 4 at 1000×700.
  - Buttons 12 px from the bottom and no page scroll in all cases, both styles; no console errors.

