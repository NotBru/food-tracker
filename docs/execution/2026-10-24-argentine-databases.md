# Argentine food composition databases: what exists, terms, can they be bundled

- **Date:** 2026-10-24
- **Status:** open question (nothing added yet)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (external databases); request in chat

## Context

The user: "Look for Argentinian databases like CIQUAL. Try to find at least 3. See that we can technically use it
for personal reasons, and also check whether we can just add it to the program".

The repo is public on GitHub, so bundling a table (as `public/ciqual.json` is) means redistributing it.

## Findings

| | ARGENFOODS (UNLu) | SARA 2 (Ministerio de Salud, 2022) | LATINFOODS portal, Argentina chapter |
|---|---|---|---|
| Where | argenfood.unlu.edu.ar/Tablas/Tabla.htm | PDF: CONICET hdl.handle.net/11336/258411, cesni-biblioteca.org | latinfoodsportal.net (`sg2=ar&sg3=arg`) |
| Data | Argentine analytical data. 12 Excel files by group, 471 foods per 100 g, INFOODS tags (ENERC, PROTCNT, FAT, CHOCDF, minerals, B vitamins, C), many gaps. Has nalga raw/cooked. | Compilation for ENNyS 2: ~1000 foods (Argentine data first, then USDA, UK, etc.), 39 components per 100 g. Only as a 142-page PDF; nalga is under "carne vacuna magra". | Mainly plant foods, search-only web portal, with SD/min/max/n per value. |
| Terms | "All rights reserved"; non-commercial use allowed "sin mutilaciones de la obra", citing authors, holders and full URL. | CC BY-NC-SA 2.5 Argentina (CONICET record). | Non-commercial sharing with citation; "total or partial reproduction" and alteration not allowed. |
| Personal use | Yes | Yes | Yes (lookups) |
| Bundle in the app | Unclear: converting to JSON alters "the work"; ask UNLu, or a local script that downloads and converts without committing the output. | Yes, non-commercially, credited, with the derived JSON under CC BY-NC-SA 2.5 AR. Needs a PDF table extractor. | No |

Not found as downloadable data: the 2010 FAO TCP/RLA/3107 compilation (search software), the IECS review of
Argentine composition data, ARFenol-Foods (polyphenols only). Open Food Facts (already in the app) covers Argentine
packaged products.

## Open questions

- Which one to add, if any (SARA 2 is the only one clearly allowed in a public repo).
- Not legal advice; ARGENFOODS's wording is the ambiguous one.
