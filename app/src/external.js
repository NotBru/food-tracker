// External food databases (design.md V2: "automatically fetch products from cool databases").
//   CIQUAL (ANSES, France): ~3.5k generic foods, bundled as public/ciqual.json (built by scripts/ciqual.py),
//     loaded on first use. Licence Ouverte, credit "ANSES-CIQUAL".
//   Open Food Facts: packaged products, fetched live from the browser. ODbL. Rate limits: 15 product
//     reads/min and 10 searches/min per IP, so searches only run on Enter, never per keystroke.
//     Text search uses search-a-licious (search.openfoodfacts.org) through the /off-search proxy in vite.config.js,
//     since it sends no CORS headers; the legacy cgi/search.pl, mostly answering 503 since 2026-10, is the fallback
//     where there is no proxy. Search hits lack serving/package sizes and most micronutrients, so picking one
//     reads the full product (offProductDraft).
// Both give values per 100 g (or 100 ml). Results become a *draft* food that prefills the "New food" form.
// Drafts carry a `provenance` attribute (CIQUAL / OFF) plus `source` ({db, id}) for the link back.

import { deltaFromInput } from './nutrients'

const OFF = 'https://world.openfoodfacts.org'
// Browsers may not set User-Agent, and a custom header would trigger a CORS preflight that the search endpoint
// rejects; OFF's app_name/app_version parameters identify the app instead.
const OFF_APP = 'app_name=food-tracker-pwa&app_version=0.1'
const OFF_FIELDS = [
  'code', 'product_name', 'brands', 'quantity', 'product_quantity', 'product_quantity_unit',
  'serving_quantity', 'serving_quantity_unit', 'nutriments',
].join(',')

/** {value, delta, text, deltaAuto} as stored on a food. No delta = from the digits typed. */
function nutrient(text, delta) {
  return { value: Number(text), text, delta: delta ?? deltaFromInput(text), deltaAuto: delta == null }
}

// The tables' "per 100 g" basis is exact, and so is the "1" in "1 serving = …"; only the other side of a unit gets
// the usual error from its digits.
const PER_100 = { amount: 100, amountText: '100', amountDelta: 0, amountDeltaAuto: false }
const ONE = { fromAmount: 1, fromText: '1', fromDelta: 0, fromDeltaAuto: false }

// --- Hand-over to the food editor ------------------------------------------------
// The external screen sits on top of "New food". Picking a result stores the draft and goes back;
// the remounted form reads it once (peek during render, clear after mount, which is safe in StrictMode).

let pending = null
export const setPendingDraft = (draft) => (pending = draft)
export const peekPendingDraft = () => pending
export const clearPendingDraft = () => (pending = null)

// --- CIQUAL --------------------------------------------------------------------------

let ciqual = null
export function loadCiqual() {
  ciqual ??= fetch(`${import.meta.env.BASE_URL}ciqual.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`CIQUAL table: HTTP ${r.status}`)
      return r.json()
    })
    .then((t) => ({
      ...t,
      foods: t.foods.map(([code, en, fr, group, values]) => ({ code, en, fr, group, values, hay: fold(`${en} ${fr}`) })),
    }))
    .catch((e) => {
      ciqual = null // allow a retry
      throw e
    })
  return ciqual
}

// Case- and accent-insensitive ("creme" finds "Crème").
const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Every word must match the English or French name; names starting with the query, then shorter names, first. */
export function searchCiqual(table, query, limit = 60) {
  const q = fold(query.trim())
  const words = q.split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return table.foods
    .filter((f) => words.every((w) => f.hay.includes(w)))
    .sort((a, b) => fold(b.en).startsWith(q) - fold(a.en).startsWith(q) || a.en.length - b.en.length)
    .slice(0, limit)
}

export function ciqualDraft(table, food) {
  const nutrients = {}
  table.keys.forEach((key, i) => {
    const v = food.values[i]
    if (v === '') return
    const [text, delta] = Array.isArray(v) ? v : [v]
    nutrients[key] = nutrient(text, delta)
  })
  return {
    name: food.en, brand: '', attributes: [['provenance', 'CIQUAL']], ...PER_100, unit: 'g', units: [], components: [], nutrients,
    source: { db: 'ciqual', id: food.code, version: table.source },
    subtitle: table.groups[food.group] ?? '',
  }
}

// --- Open Food Facts -------------------------------------------------------------------

// App key -> [OFF nutriment, factor from OFF's per-100 g value (always grams, kcal for energy)].
const G = 1, MG = 1e3, UG = 1e6
const OFF_MAP = {
  energy: ['energy-kcal', 1], proteins: ['proteins', G], fat: ['fat', G],
  saturatedFat: ['saturated-fat', G], monounsaturatedFat: ['monounsaturated-fat', G],
  polyunsaturatedFat: ['polyunsaturated-fat', G], omega3: ['omega-3-fat', G], transFat: ['trans-fat', G], cholesterol: ['cholesterol', MG],
  carbohydrates: ['carbohydrates', G], sugars: ['sugars', G], addedSugars: ['added-sugars', G], fibers: ['fiber', G],
  sodium: ['sodium', MG], salt: ['salt', G], potassium: ['potassium', MG], chloride: ['chloride', MG],
  calcium: ['calcium', MG], phosphorus: ['phosphorus', MG], magnesium: ['magnesium', MG], iron: ['iron', MG],
  zinc: ['zinc', MG], copper: ['copper', MG], manganese: ['manganese', MG], fluoride: ['fluoride', MG],
  selenium: ['selenium', UG], chromium: ['chromium', UG], molybdenum: ['molybdenum', UG], iodine: ['iodine', UG],
  vitaminA: ['vitamin-a', UG], vitaminB1: ['vitamin-b1', MG], vitaminB2: ['vitamin-b2', MG],
  vitaminB3: ['vitamin-pp', MG], vitaminB5: ['pantothenic-acid', MG], vitaminB6: ['vitamin-b6', MG],
  vitaminB7: ['biotin', UG], vitaminB9: ['vitamin-b9', UG], vitaminB12: ['vitamin-b12', UG],
  vitaminC: ['vitamin-c', MG], vitaminD: ['vitamin-d', UG], vitaminE: ['vitamin-e', MG], vitaminK: ['vitamin-k', UG],
  caffeine: ['caffeine', MG], creatine: ['creatine', G], water: ['water', G],
}

// Unit conversion leaves float noise (0.0225 g -> 22.500000000000004 µg); 4 significant digits keeps the label's
// precision for typical values, and the Δ then follows from those digits like a typed value.
const tidy = (x) => String(Number(x.toPrecision(4)))

function offNutrients(n = {}) {
  const out = {}
  for (const [key, [off, factor]] of Object.entries(OFF_MAP)) {
    const v = n[`${off}_100g`]
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = nutrient(tidy(v * factor))
  }
  if (!out.energy && Number.isFinite(n['energy-kj_100g'])) out.energy = nutrient(tidy(n['energy-kj_100g'] / 4.184))
  // OFF stores alcohol as % vol; ethanol is 0.789 g/ml.
  if (Number.isFinite(n.alcohol_100g)) out.alcohol = nutrient(tidy(n.alcohol_100g * 0.789))
  return out
}

export function offDraft(p) {
  const unit = p.product_quantity_unit === 'ml' ? 'ml' : 'g'
  const units = []
  const serving = Number(p.serving_quantity)
  if (serving > 0) units.push({ ...ONE, fromUnit: 'serving', toAmount: serving, toUnit: p.serving_quantity_unit || unit })
  const pack = Number(p.product_quantity)
  if (pack > 0) units.push({ ...ONE, fromUnit: 'package', toAmount: pack, toUnit: p.product_quantity_unit || unit })
  // Legacy API: "A, B"; search-a-licious: ["A", "B"].
  const brand = String(Array.isArray(p.brands) ? p.brands[0] ?? '' : p.brands ?? '').split(',')[0].trim()
  return {
    name: (p.product_name || '').trim() || `Product ${p.code}`, brand, attributes: [['provenance', 'OFF']], ...PER_100, unit, units,
    components: [], nutrients: offNutrients(p.nutriments),
    source: { db: 'off', id: p.code },
    subtitle: [brand, p.quantity].filter(Boolean).join(' · '),
  }
}

async function offGet(url) {
  let r
  try {
    r = await fetch(`${url}&${OFF_APP}`)
  } catch {
    throw new Error("Open Food Facts didn't answer (offline, or busy / rate-limited). Try again in a minute.")
  }
  if (r.status === 429) throw new Error('Open Food Facts rate limit reached (10 searches per minute). Try again shortly.')
  if (r.status === 503) throw new Error('Open Food Facts search is temporarily unavailable. Try again in a minute.')
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Open Food Facts: HTTP ${r.status}`)
  // A static host without the proxy answers /off-search with the app's index.html.
  if (!r.headers.get('content-type')?.includes('json')) return null
  return r.json()
}

const hasPer100 = (p) => p.nutriments && Object.keys(p.nutriments).some((k) => k.endsWith('_100g'))

// Barcodes are printed in groups ("3 017620 422003"); the small digits outside the bars are part of the code.
const digitsOnly = (q) => q.replace(/[\s-]/g, '')
export const isBarcode = (q) => /^\d{8,14}$/.test(digitsOnly(q))

/** Barcode -> [product] (or []); text -> up to 24 products that have nutrition data. */
export async function searchOff(query) {
  const q = query.trim()
  if (isBarcode(q)) {
    const code = digitsOnly(q)
    const res = await offGet(`${OFF}/api/v2/product/${code}.json?fields=${OFF_FIELDS}`)
    return res?.status === 1 && res.product ? [{ ...res.product, code: res.product.code ?? code }] : []
  }
  const params = new URLSearchParams({ q, page_size: 24, fields: OFF_FIELDS })
  const res = await offGet(`${import.meta.env.BASE_URL}off-search/search?${params}`)
  if (res?.hits) return res.hits.filter(hasPer100)
  const legacy = new URLSearchParams({
    search_terms: q, search_simple: 1, action: 'process', json: 1, page_size: 24, fields: OFF_FIELDS,
  })
  const old = await offGet(`${OFF}/cgi/search.pl?${legacy}`)
  return (old?.products ?? []).filter(hasPer100)
}

/** The full product behind a search hit's draft; the hit's own draft if the read fails. */
export async function offProductDraft(draft) {
  try {
    const res = await offGet(`${OFF}/api/v2/product/${draft.source.id}.json?fields=${OFF_FIELDS}`)
    if (res?.status === 1 && res.product && hasPer100(res.product)) return offDraft({ ...res.product, code: draft.source.id })
  } catch {
    // Rate limit or outage: the search hit still has name, brand and the main nutrients.
  }
  return draft
}

export function sourceLabel(source) {
  if (!source) return null
  if (source.db === 'ciqual') return { text: `${source.version ?? 'ANSES-CIQUAL'} · food #${source.id}`, href: `https://ciqual.anses.fr/#/aliments/${source.id}` }
  if (source.db === 'off') return { text: `Open Food Facts · ${source.id}`, href: `${OFF}/product/${source.id}` }
  return null
}

