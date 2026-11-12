// External food databases (design.md V2: "automatically fetch products from cool databases").
//   CIQUAL (ANSES, France): ~3.5k generic foods, bundled as public/ciqual.json (built by scripts/ciqual.py, Spanish
//     names from scripts/es/),
//     loaded on first use. Licence Ouverte, credit "ANSES-CIQUAL". Its foods are part of the food database,
//     read-only (ciqualFoods); editing one saves a copy.
//   USDA FoodData Central: Foundation Foods and SR Legacy, ~8.1k generic foods, bundled as public/fdc.json (built by
//     scripts/fdc.py, Spanish names from scripts/es/), loaded on first use, in the food database like CIQUAL's (fdcFoods). Public domain (CC0).
//   Open Food Facts: packaged products, from our own copy on the server (off/server.mjs, behind /off/ on the app's
//     origin; vite.config.js relays it to production's in development), rebuilt from OFF's exports and updated daily.
//     Its products come in the shape of OFF's API. Where the copy can't answer (server down, or a barcode newer than
//     it), OFF is asked directly: products by barcode (15 reads/min per IP), and text through the legacy
//     cgi/search.pl, which mostly answers 503 since 2026-10. ODbL.
// Both give values per 100 g (or 100 ml). OFF results become a *draft* food that prefills the "New food" form.
// Drafts carry a `database` attribute (CIQUAL / USDA / OFF) plus `source` ({db, id}) for the link back.

import { deltaFromInput } from './nutrients'
import { getLang, t } from './i18n'

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
      foods: t.foods.map(([code, en, fr, group, values, es]) => ({ code, en, fr, group, values, es })),
    }))
    .catch((e) => {
      ciqual = null // allow a retry
      throw e
    })
  return ciqual
}

/**
 * A reference database's foods as read-only foods of the app (calc.js loadContext), made only when asked for: `get(id)`
 * one (a consumption of it), `all()` every one (searches). Making all ~11.6k of CIQUAL's and USDA's took most of the
 * app's start, for the few the homescreen needs (docs/execution/2026-11-02-fast-start.md). Made in the app's language
 * (i18n.js): its name and group; each language its own set, made when first asked for in it.
 */
function lazyFoods(load, idOf, make) {
  const byLang = new Map()
  return () => {
    const lang = getLang()
    if (!byLang.has(lang)) {
      byLang.set(lang, load()
        .then((t) => {
          const rows = new Map(t.foods.map((f) => [idOf(f), f]))
          const made = new Map()
          const get = (id) => {
            if (!made.has(id)) made.set(id, rows.has(id) ? { ...make(t, rows.get(id), lang), id, readOnly: true } : undefined)
            return made.get(id)
          }
          let all = null
          return { get, all: () => (all ??= [...rows.keys()].map(get)) }
        })
        .catch((e) => {
          byLang.delete(lang) // allow a retry
          throw e
        }))
    }
    return byLang.get(lang)
  }
}

/** A reference food's name in `lang` (English if it has none) and its other names, for searches (search.js). */
function names(lang, en, others) {
  const name = (lang === 'es' && others.es) || en
  return { name, otherNames: [en, ...Object.values(others)].filter((n) => n && n !== name) }
}

// CIQUAL's: id "ciqual:<code>", the subgroup as their category.
export const ciqualFoods = lazyFoods(loadCiqual, (f) => `ciqual:${f.code}`, ciqualDraft)

// CIQUAL is per 100 g, but liquids are measured in ml: they get "100 ml = X g", the density from their composition,
// 1/ρ = Σ wᵢ/ρᵢ (g/ml: water 1, fat 0.925, protein 1.33, carbohydrates 1.6, fibre 1.31, alcohol 0.789, Choi & Okos;
// the rest, minerals and anything not given, as carbohydrates). Within about 3% for milks, juices, oils, beer and
// wine; 5% for spirits, and when the water (an oil's fat) isn't given and is taken as what's left.
const LIQUID_GROUPS = new Set(['0102', '0501', '0504', '0601', '0602', '0603', '0902', '0904', '1101'])
const isLiquid = (food) => (LIQUID_GROUPS.has(food.group) || /\b(drink|beverage)/i.test(food.en))
  && !/powder|dehydrated(?! and reconstituted)|granul|freeze-dried|ground|leaf|leaves/i.test(food.en)
const OILS = new Set(['0902', '0904'])
const DENSITY = { water: 1, fat: 0.925, proteins: 1.33, carbohydrates: 1.6, fibers: 1.31, alcohol: 0.789 }

function mlUnit(food, nutrients) {
  const w = {}
  for (const k in DENSITY) if (Number.isFinite(nutrients[k]?.value)) w[k] = nutrients[k].value
  const sum = () => Object.values(w).reduce((a, b) => a + b, 0)
  const main = OILS.has(food.group) ? 'fat' : 'water'
  const guessed = !(main in w)
  if (guessed) w[main] = Math.max(0, 100 - sum())
  if (guessed && main === 'water' && w.water < 50) return null // more likely a dry food than a liquid
  const rest = Math.max(0, 100 - sum())
  const density = 100 / (Object.entries(w).reduce((a, [k, x]) => a + x / DENSITY[k], 0) + rest / DENSITY.carbohydrates)
  const g = Number((100 * density).toFixed(1))
  // Spirits shrink when mixed (vodka is ~4% denser than this), so they get the wider error too.
  const delta = Number((g * (guessed || w.alcohol > 10 ? 0.05 : 0.03)).toFixed(1))
  return { fromAmount: 100, fromText: '100', fromDelta: 0, fromDeltaAuto: false, fromUnit: 'ml',
    toAmount: g, toText: String(g), toDelta: delta, toDeltaAuto: false, toUnit: 'g' }
}

export function ciqualDraft(table, food, lang = 'en') {
  const nutrients = {}
  table.keys.forEach((key, i) => {
    const v = food.values[i]
    if (v === '') return
    const [text, delta] = Array.isArray(v) ? v : [v]
    nutrients[key] = nutrient(text, delta)
  })
  const ml = isLiquid(food) && mlUnit(food, nutrients)
  const units = ml ? [ml] : []
  return {
    ...names(lang, food.en, { fr: food.fr, es: food.es }),
    brand: '', attributes: [['database', 'CIQUAL']], ...PER_100, unit: 'g', units, components: [], nutrients,
    category: food.group,
    source: { db: 'ciqual', id: food.code, version: table.source },
    subtitle: (lang === 'es' && table.groupsEs?.[food.group]) || table.groups[food.group] || '',
  }
}

// --- USDA FoodData Central ------------------------------------------------------------
// The table's texts already carry FDC's precision (zeros too: "0.00"), so a value's Δ follows from its digits. Its
// household measures ("1 cup = 244 g") are units; "cup", "tbsp", "tsp" and "fl oz" are named like the built-in volumes,
// so a liquid's ml follow from them.

let fdc = null
export function loadFdc() {
  fdc ??= fetch(`${import.meta.env.BASE_URL}fdc.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`USDA table: HTTP ${r.status}`)
      return r.json()
    })
    .then((t) => ({
      ...t,
      foods: t.foods.map(([id, name, dataset, category, group, values, units, es]) => ({ id, name, dataset, category, group, values, units, es })),
    }))
    .catch((e) => {
      fdc = null // allow a retry
      throw e
    })
  return fdc
}

// USDA's, like CIQUAL's: id "fdc:<fdcId>", category the CIQUAL subgroup scripts/fdc.py gave them.
export const fdcFoods = lazyFoods(loadFdc, (f) => `fdc:${f.id}`, fdcDraft)

export function fdcDraft(table, food, lang = 'en') {
  const nutrients = {}
  table.keys.forEach((key, i) => {
    if (food.values[i] !== '') nutrients[key] = nutrient(food.values[i])
  })
  const units = food.units.map(([amount, unit, grams]) => ({
    fromAmount: Number(amount), fromText: amount, fromDelta: 0, fromDeltaAuto: false, fromUnit: unit,
    toAmount: Number(grams), toText: grams, toDelta: deltaFromInput(grams), toDeltaAuto: true, toUnit: 'g',
  }))
  const dataset = table.datasets[food.dataset]
  return {
    ...names(lang, food.name, { es: food.es }),
    brand: '', attributes: [['database', 'USDA']], ...PER_100, unit: 'g', units, components: [], nutrients,
    category: food.category,
    source: { db: 'fdc', id: food.id, version: dataset },
    subtitle: [(lang === 'es' && table.groupsEs?.[food.group]) || table.groups[food.group], dataset].filter(Boolean).join(' · '),
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
  // "A, B" (OFF's API); also accepts ["A", "B"].
  const brand = String(Array.isArray(p.brands) ? p.brands[0] ?? '' : p.brands ?? '').split(',')[0].trim()
  return {
    name: (p.product_name || '').trim() || t('Product {code}', { code: p.code }), brand, attributes: [['database', 'OFF']], ...PER_100, unit, units,
    components: [], nutrients: offNutrients(p.nutriments),
    source: { db: 'off', id: p.code },
    subtitle: [brand, p.quantity].filter(Boolean).join(' · '),
  }
}

/** Our copy: its JSON, null if it doesn't have that product, undefined if it can't answer. */
async function copyGet(path) {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}off/${path}`)
    if (r.status === 404) return null
    // A static host without the copy answers /off/ with the app's index.html; 503 while it's first built.
    if (r.ok && r.headers.get('content-type')?.includes('json')) return await r.json()
  } catch {
    // Offline, or the server is down.
  }
  return undefined
}

/** Open Food Facts itself. */
async function offGet(url) {
  let r
  try {
    r = await fetch(`${url}&${OFF_APP}`)
  } catch {
    throw new Error(t("Open Food Facts didn't answer (offline, or busy / rate-limited). Try again in a minute."))
  }
  if (r.status === 429) throw new Error(t('Open Food Facts rate limit reached. Try again in a minute.'))
  if (r.status === 503) throw new Error(t('Open Food Facts search is temporarily unavailable. Try again in a minute.'))
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Open Food Facts: HTTP ${r.status}`)
  if (!r.headers.get('content-type')?.includes('json')) return null
  return r.json()
}

/** A product by barcode, from our copy, else from OFF (newer than the copy, or no copy to ask); null if neither has it. */
async function offProduct(code) {
  const mine = await copyGet(`product/${code}`)
  if (mine?.product) return mine.product
  const res = await offGet(`${OFF}/api/v2/product/${code}.json?fields=${OFF_FIELDS}`)
  return res?.status === 1 && res.product ? { ...res.product, code: res.product.code ?? code } : null
}

const hasPer100 = (p) => p.nutriments && Object.keys(p.nutriments).some((k) => k.endsWith('_100g'))

// Barcodes are printed in groups ("3 017620 422003"); the small digits outside the bars are part of the code.
const digitsOnly = (q) => q.replace(/[\s-]/g, '')
export const isBarcode = (q) => /^\d{8,14}$/.test(digitsOnly(q))

/** Barcode -> [product] (or []); text -> up to 24 products that have nutrition data. */
export async function searchOff(query) {
  const q = query.trim()
  if (isBarcode(q)) {
    const product = await offProduct(digitsOnly(q))
    return product ? [product] : []
  }
  const mine = await copyGet(`search?${new URLSearchParams({ q, page_size: 24 })}`)
  if (mine?.hits) return mine.hits
  const legacy = new URLSearchParams({
    search_terms: q, search_simple: 1, action: 'process', json: 1, page_size: 24, fields: OFF_FIELDS,
  })
  const old = await offGet(`${OFF}/cgi/search.pl?${legacy}`)
  return (old?.products ?? []).filter(hasPer100)
}

/**
 * The full product behind a search hit's draft (a hit from cgi/search.pl may lack serving/package sizes and some
 * nutrients); the hit's own draft if the read fails.
 */
export async function offProductDraft(draft) {
  try {
    const product = await offProduct(draft.source.id)
    if (product && hasPer100(product)) return offDraft({ ...product, code: draft.source.id })
  } catch {
    // Rate limit or outage: the search hit still has name, brand and the main nutrients.
  }
  return draft
}

export function sourceLabel(source) {
  if (!source) return null
  if (source.db === 'ciqual') return { text: `${source.version ?? 'ANSES-CIQUAL'} · ${t('food #{id}', { id: source.id })}`, href: `https://ciqual.anses.fr/#/aliments/${source.id}` }
  if (source.db === 'fdc') return { text: `USDA ${source.version ?? 'FoodData Central'} · FDC #${source.id}`, href: `https://fdc.nal.usda.gov/food-details/${source.id}/nutrients` }
  if (source.db === 'off') return { text: `Open Food Facts · ${source.id}`, href: `${OFF}/product/${source.id}` }
  return null
}

