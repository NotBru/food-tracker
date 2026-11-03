// Open Food Facts, served from our own copy: the app's product search and barcode lookups, without OFF's rate limits
// or its search outages.
//
// The copy is a SQLite file built from OFF's full export (openfoodfacts-products.jsonl.gz, ~13 GB, streamed: never
// stored), then kept current with OFF's daily delta files (the products changed that day, ~20 MB; OFF keeps two
// weeks of them). Only food products with nutrition values per 100 g/ml are kept, and of each only what the app reads
// (app/src/external.js, OFF_FIELDS), in the same shape as OFF's own API, so the app's code reads either.
//
//   GET /off/search?q=…&page_size=24   {hits: [product, …]}: every word matches the start of a word of the name
//                                      (in any language) or the brand; best match first, then most scanned
//   GET /off/product/<barcode>         {status: 1, product}, or 404
//   GET /off/status                    product count, export date, deltas applied up to, import progress (lines of
//                                      the export read, products kept), last error
//
// Updates run in this process: at start, then every 6 h. A full import is made into a new file, which replaces the
// served one once complete, so searches keep working meanwhile (except during the first one, which answers 503). It
// runs when there's no copy, when it's older than FULL_DAYS (deletions on OFF only show up that way), or when deltas
// were missed (OFF only keeps two weeks of them). Otherwise new deltas are applied in place.
//
//   node server.mjs           serve on $PORT (8080), data in $DATA_DIR (/data)
//
// Data: off.sqlite (served), off.new.sqlite (a full import under way). Licence: ODbL, credit Open Food Facts.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import readline from 'node:readline'
import { Readable } from 'node:stream'
import { DatabaseSync } from 'node:sqlite'

const DATA = process.env.DATA_DIR ?? '/data'
const PORT = Number(process.env.PORT ?? 8080)
const SOURCE = process.env.OFF_DATA_URL ?? 'https://static.openfoodfacts.org/data'
const FULL_DAYS = Number(process.env.FULL_DAYS ?? 30)
const CHECK_MS = 6 * 60 * 60 * 1000
const UA = 'track-shit-off-mirror/1 (https://track-shit.notbru.xyz)'

const MAIN = path.join(DATA, 'off.sqlite')
const NEW = path.join(DATA, 'off.new.sqlite')
const KEEP = ['product_name', 'brands', 'quantity', 'product_quantity', 'product_quantity_unit', 'serving_quantity',
  'serving_quantity_unit']

let db = null // the served copy; null until the first full import completes
let progress = null // {started, products, kept} while a full import runs
let lastError = null

// --- The database ----------------------------------------------------------------------------------------------------

function open(file) {
  const d = new DatabaseSync(file)
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, names TEXT NOT NULL, brands TEXT NOT NULL,
      popularity REAL NOT NULL, modified INTEGER NOT NULL, data BLOB NOT NULL);
    CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(names, brands, content = 'products', content_rowid = 'id',
      tokenize = 'unicode61 remove_diacritics 2');
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `)
  return d
}

// Kept in step with products on the served copy. A full import fills the index once at the end instead (faster).
function addTriggers(d) {
  d.exec(`
    CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
      INSERT INTO search (rowid, names, brands) VALUES (new.id, new.names, new.brands);
    END;
    CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
      INSERT INTO search (search, rowid, names, brands) VALUES ('delete', old.id, old.names, old.brands);
    END;
    CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
      INSERT INTO search (search, rowid, names, brands) VALUES ('delete', old.id, old.names, old.brands);
      INSERT INTO search (rowid, names, brands) VALUES (new.id, new.names, new.brands);
    END;
  `)
}

const getMeta = (d, key) => d.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value
const setMeta = (d, key, value) => d.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, String(value))

/**
 * An OFF product as stored: what the app reads, nutrients as OFF's API gives them ("<nutrient>_100g", in g, kcal, kJ
 * or % vol), plus what search needs. Null for a product the app can't use (no values per 100 g/ml as sold).
 */
function trim(p) {
  if (!p.code || (p.product_type && p.product_type !== 'food')) return null
  const nutriments = {}
  const set = p.nutrition?.aggregated_set
  if (set) {
    // OFF's nutrition schema since 2026: values per 100 g/ml, from the label or computed from a per-serving one. Those
    // estimated from the ingredients are left out, as OFF's API does, except added sugars, which it gives.
    if (set.preparation === 'as_sold' && (set.per === '100g' || set.per === '100ml')) {
      for (const [k, v] of Object.entries(set.nutrients ?? {})) {
        if (Number.isFinite(v?.value) && (v.source !== 'estimate' || k === 'added-sugars')) nutriments[`${k}_100g`] = v.value
      }
    }
  } else {
    for (const [k, v] of Object.entries(p.nutriments ?? {})) {
      if (k.endsWith('_100g') && !k.endsWith('_prepared_100g') && Number.isFinite(v)) nutriments[k] = v
    }
  }
  if (!Object.keys(nutriments).length) return null
  const product = { code: p.code }
  for (const k of KEEP) if (p[k] != null && p[k] !== '') product[k] = p[k]
  product.nutriments = nutriments
  // Names in every language, so "dulce de leche" also finds a product whose main name is in another one.
  const names = new Map()
  for (const [k, v] of Object.entries(p)) {
    if ((k === 'product_name' || k.startsWith('product_name_')) && typeof v === 'string' && v.trim()) {
      names.set(v.trim().toLowerCase(), v.trim())
    }
  }
  return {
    code: p.code,
    names: [...names.values()].join(' | '),
    brands: Array.isArray(p.brands) ? p.brands.join(', ') : String(p.brands ?? ''),
    popularity: Math.log1p(Number(p.unique_scans_n) || 0),
    modified: Number(p.last_modified_t) || 0,
    // Compressed: half the size (nutrient names repeat across rows, not within one).
    data: zlib.deflateRawSync(JSON.stringify(product)),
  }
}

// --- Updates ---------------------------------------------------------------------------------------------------------

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res
}

/**
 * Each product of a gzipped JSONL download, counting lines in `count.lines`. `skip`: lines with no nutrition values
 * aren't even parsed.
 */
async function* products(res, skip = false, count = {}) {
  const lines = readline.createInterface({ input: Readable.fromWeb(res.body).pipe(zlib.createGunzip()), crlfDelay: Infinity })
  count.lines = 0
  for await (const line of lines) {
    count.lines++
    if (skip && !line.includes('_100g') && !line.includes('"aggregated_set"')) continue
    try {
      yield JSON.parse(line)
    } catch {
      // A broken line in the export: skip it.
    }
  }
}

/** The whole export into a new file, which then replaces the served one. */
async function fullImport() {
  console.log('Full import: starting')
  const started = Date.now()
  for (const f of [NEW, `${NEW}-wal`, `${NEW}-shm`]) fs.rmSync(f, { force: true })
  const res = await download(`${SOURCE}/openfoodfacts-products.jsonl.gz`)
  const exported = Date.parse(res.headers.get('last-modified')) || Date.now()
  const d = open(NEW)
  d.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF')
  const insert = d.prepare(`INSERT INTO products (code, names, brands, popularity, modified, data)
    VALUES (:code, :names, :brands, :popularity, :modified, :data)
    ON CONFLICT (code) DO UPDATE SET names = excluded.names, brands = excluded.brands, popularity = excluded.popularity,
      modified = excluded.modified, data = excluded.data WHERE excluded.modified >= products.modified`)
  progress = { started: new Date().toISOString(), lines: 0, kept: 0 }
  try {
    d.exec('BEGIN')
    for await (const p of products(res, true, progress)) {
      const row = trim(p)
      if (!row) continue
      insert.run(row)
      if (++progress.kept % 20000 === 0) {
        d.exec('COMMIT; BEGIN')
        if (progress.kept % 500000 === 0) console.log(`Full import: ${progress.lines} read, ${progress.kept} kept`)
      }
    }
    d.exec('COMMIT')
    d.exec("INSERT INTO search (search) VALUES ('rebuild'); INSERT INTO search (search) VALUES ('optimize')")
    addTriggers(d)
    setMeta(d, 'exported', new Date(exported).toISOString())
    // The export is made over some hours before its date; deltas from two days before overlap it, and products
    // already newer here are left as they are (by last_modified_t).
    setMeta(d, 'deltas_until', Math.floor(exported / 1000) - 2 * 86400)
    d.exec('PRAGMA journal_mode = WAL')
    d.close()
  } catch (e) {
    d.close()
    throw e
  } finally {
    progress = null
  }
  // Swap in one synchronous run: no request sees a closed database.
  db?.close()
  for (const f of [`${MAIN}-wal`, `${MAIN}-shm`]) fs.rmSync(f, { force: true })
  fs.renameSync(NEW, MAIN)
  db = open(MAIN)
  console.log(`Full import: done in ${Math.round((Date.now() - started) / 60000)} min, ${db.prepare('SELECT count(*) AS n FROM products').get().n} products`)
}

/** Delta files not applied yet, oldest first; null when some were missed (OFF keeps two weeks of them). */
async function pendingDeltas(until) {
  const index = await (await download(`${SOURCE}/delta/index.txt`)).text()
  const files = index.split('\n').map((name) => name.trim().match(/^openfoodfacts_products_(\d+)_(\d+)\.json\.gz$/))
    .filter(Boolean).map(([name, from, to]) => ({ name, from: Number(from), to: Number(to) }))
    .sort((a, b) => a.from - b.from)
  const fresh = files.filter((f) => f.to > until)
  return fresh.length && fresh[0].from > until ? null : fresh
}

async function applyDelta(file) {
  const res = await download(`${SOURCE}/delta/${file.name}`)
  const upsert = db.prepare(`INSERT INTO products (code, names, brands, popularity, modified, data)
    VALUES (:code, :names, :brands, :popularity, :modified, :data)
    ON CONFLICT (code) DO UPDATE SET names = excluded.names, brands = excluded.brands, popularity = excluded.popularity,
      modified = excluded.modified, data = excluded.data WHERE excluded.modified >= products.modified`)
  const remove = db.prepare('DELETE FROM products WHERE code = ? AND modified <= ?')
  // Read whole before writing, so a broken download leaves the copy as it was.
  const rows = []
  for await (const p of products(res)) rows.push(trim(p) ?? { code: p.code, modified: Number(p.last_modified_t) || 0, gone: true })
  db.exec('BEGIN')
  try {
    for (const row of rows) {
      if (!row.code) continue
      if (row.gone) remove.run(row.code, row.modified)
      else upsert.run(row)
    }
    setMeta(db, 'deltas_until', file.to)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  console.log(`Delta ${file.name}: ${rows.length} products`)
}

async function update() {
  try {
    const exported = db && Date.parse(getMeta(db, 'exported'))
    let deltas = db && Date.now() - exported < FULL_DAYS * 86400e3 ? await pendingDeltas(Number(getMeta(db, 'deltas_until'))) : null
    if (!deltas) {
      await fullImport()
      deltas = await pendingDeltas(Number(getMeta(db, 'deltas_until'))) ?? []
    }
    for (const file of deltas) await applyDelta(file)
    lastError = null
  } catch (e) {
    console.error(e)
    lastError = { at: new Date().toISOString(), message: String(e.message ?? e) }
  }
}

// --- Serving ---------------------------------------------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const unpack = (row) => JSON.parse(zlib.inflateRawSync(row.data))

function ready() {
  if (!db) throw new HttpError(503, 'The copy of Open Food Facts is still being built.')
  return db
}

/** Words to FTS5: each must start a word of the name or brand ("leche ent" finds "Leche entera"). */
function matchQuery(q) {
  const words = q.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  return words.slice(0, 10).map((w) => (w.length > 1 ? `"${w}"*` : `"${w}"`)).join(' ')
}

function search(params) {
  const match = matchQuery(params.get('q') ?? '')
  if (!match) return { hits: [] }
  const size = Math.min(Math.max(Number(params.get('page_size')) || 24, 1), 100)
  // bm25 is negative, better matches lower; the name counts more than the brand. Popularity is ln(1 + scans).
  const rows = ready().prepare(`SELECT p.data FROM search JOIN products p ON p.id = search.rowid
    WHERE search MATCH ? ORDER BY bm25(search, 3.0, 1.0) - 0.5 * p.popularity LIMIT ?`).all(match, size)
  return { hits: rows.map(unpack) }
}

function product(code) {
  if (!/^\d{1,14}$/.test(code)) throw new HttpError(400, 'Bad barcode.')
  // OFF stores codes of 9 to 12 digits padded to 13; shorter ones as they are.
  const forms = [code, code.padStart(13, '0'), code.replace(/^0+(?=\d{8})/, '')]
  const row = ready().prepare('SELECT data FROM products WHERE code IN (?, ?, ?)').get(...forms)
  if (!row) throw new HttpError(404, 'Product not found.')
  return { status: 1, product: unpack(row) }
}

function status() {
  return {
    products: db?.prepare('SELECT count(*) AS n FROM products').get().n ?? 0,
    exported: db && getMeta(db, 'exported'),
    deltasUntil: db && new Date(Number(getMeta(db, 'deltas_until')) * 1000).toISOString(),
    importing: progress,
    lastError,
  }
}

function handle(req) {
  const url = new URL(req.url, 'http://x')
  if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed.')
  if (url.pathname === '/off/search') return search(url.searchParams)
  if (url.pathname.startsWith('/off/product/')) return product(url.pathname.slice('/off/product/'.length))
  if (url.pathname === '/off/status') return status()
  throw new HttpError(404, 'Not found.')
}

function serve() {
  if (fs.existsSync(MAIN)) db = open(MAIN)
  http.createServer((req, res) => {
    let code = 200, json
    try {
      json = handle(req)
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e)
      code = e.status ?? 500
      json = { status: 0, error: e instanceof HttpError ? e.message : 'Server error.' }
    }
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(json))
  }).listen(PORT, () => console.log(`Open Food Facts copy on :${PORT}, data in ${DATA}`))
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    await update()
    running = false
  }
  tick()
  setInterval(tick, CHECK_MS)
}

fs.mkdirSync(DATA, { recursive: true })
serve()
