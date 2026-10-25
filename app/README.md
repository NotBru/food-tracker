# Food Tracker (app)

Vite + React PWA. All data is stored in the browser's IndexedDB on the device that opens it.

```sh
npm install
npm run dev       # dev server on 0.0.0.0:5173 (hot reload)
npm run build     # static files in dist/
npm run preview   # serve dist/ on 0.0.0.0:4173
```

Run `../serve.sh` on the host to serve it at `localhost:5173` from its own Docker container
(restarts at boot; `--stop`, `--lan`). See the comments at the top of the script.

Design: `../docs/instructions/design.md` · Decisions: `../docs/execution/`

## External food data

- **CIQUAL** (ANSES, France; Licence Ouverte): `public/ciqual.json` is generated from the official XML tables.
  To update it, download the XML archive from the download page at <https://ciqual.anses.fr/>, extract it, and run
  `python3 scripts/ciqual.py <extracted dir> <version, e.g. 2025>`.
- **USDA FoodData Central** (public domain, CC0): `public/fdc.json` is generated from the Foundation Foods and SR
  Legacy CSV downloads at <https://fdc.nal.usda.gov/download-datasets>. Extract both and run
  `python3 scripts/fdc.py <Foundation Foods csv dir> <SR Legacy csv dir>`.
- **Open Food Facts** (ODbL): queried live from the browser; no key needed.
