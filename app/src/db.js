import Dexie from 'dexie'
import { deltaFromInput } from './nutrients'

export const db = new Dexie('food-tracker')

// v1 had separate ingredients / recipes / concoctions tables.
db.version(1).stores({
  ingredients: '++id, name',
  recipes: '++id, name',
  concoctions: '++id, name, madeAt',
  conversions: '++id, itemKey',
  logs: '++id, datetime',
  config: 'key',
})

// v2 merges them into one `items` table (see docs/execution/2026-10-15-unified-items.md).
db.version(2)
  .stores({ items: '++id, name' })
  .upgrade(async (tx) => {
    const old = {}
    for (const t of ['ingredients', 'recipes', 'concoctions', 'conversions', 'logs']) old[t] = await tx.table(t).toArray()
    const { items, logs, conversions } = migrateV1(old)
    await tx.table('items').bulkAdd(items)
    await tx.table('logs').clear()
    await tx.table('logs').bulkAdd(logs)
    await tx.table('conversions').clear()
    await tx.table('conversions').bulkAdd(conversions)
  })

db.version(3).stores({ ingredients: null, recipes: null, concoctions: null })

// v4: automatic Δ changed from half a unit of the last digit to one unit (see docs/execution).
db.version(4).stores({}).upgrade((tx) => tx.table('items').toCollection().modify(refreshAutoDeltas))

/** Recompute automatic Δs from the typed text (keeps old data and old exports in line with deltaFromInput). */
export function refreshAutoDeltas(item) {
  for (const n of Object.values(item.nutrients ?? {})) {
    if (n.deltaAuto && n.text) n.delta = deltaFromInput(n.text)
  }
  return item
}

// v5: unit conversions move into each food (`item.units`); conversions for "any item" are dropped.
db.version(5).stores({}).upgrade(async (tx) => {
  const conversions = await tx.table('conversions').toArray()
  const items = moveConversions(await tx.table('items').toArray(), conversions)
  await tx.table('items').bulkPut(items)
})

db.version(6).stores({ conversions: null })

/** Attach each food-specific conversion to its food as a unit; generic ones are dropped. */
export function moveConversions(items, conversions = []) {
  return items.map((item) => {
    const key = itemKey(item)
    const own = conversions
      .filter((c) => (c.itemId != null ? c.itemId === item.id : c.itemKey && c.itemKey === key))
      .map(({ fromAmount, fromUnit, toAmount, toUnit }) => ({ fromAmount, fromUnit, toAmount, toUnit }))
    return { ...item, units: [...(item.units ?? []), ...own] }
  })
}

// v7: targets get their own table, each valid from its timestamp until the next one (design.md: Targets screen).
db.version(7)
  .stores({ targets: '++id, validFrom' })
  .upgrade(async (tx) => {
    const row = await tx.table('config').get('main')
    const first = await tx.table('logs').orderBy('datetime').first()
    const target = targetFromOldConfig(row?.value, first?.datetime)
    if (target) await tx.table('targets').add(target)
    if (row?.value?.targets) {
      const { targets, ...rest } = row.value
      await tx.table('config').put({ key: 'main', value: rest })
    }
  })

/** Old config `targets: {energy, proteins, …}` -> a target valid since the first consumption (or now). */
export function targetFromOldConfig(config, firstDatetime) {
  const values = Object.fromEntries(
    Object.entries(config?.targets ?? {}).filter(([, v]) => v != null && Number.isFinite(v)),
  )
  if (!Object.keys(values).length) return null
  return { validFrom: firstDatetime ?? new Date().toISOString(), values }
}

// v8: a target value becomes a range {min?, max?}. An old single value v becomes 0.9v–1.1v, which is what the
// dashboard used to count as "on target".
db.version(8).stores({}).upgrade((tx) => tx.table('targets').toCollection().modify(targetToRange))

export function targetToRange(target) {
  const r = (x) => Math.round(x * 1000) / 1000
  for (const [k, v] of Object.entries(target.values ?? {})) {
    if (typeof v === 'number') target.values[k] = { min: r(v * 0.9), max: r(v * 1.1) }
  }
  return target
}

// v9: every amount's error defaults from its digits, like nutrient values. Amounts also keep their typed text
// (precision) and an "auto" flag. An explicit Δ > 0 stays; 0/none becomes the digits default, except where the
// amount is divided by (per amount, units) and ±digits would reach 0 ("1 slice"): those stay exact.
db.version(9).stores({}).upgrade(async (tx) => {
  await tx.table('items').toCollection().modify(itemAmountDeltas)
  await tx.table('logs').toCollection().modify(logAmountDeltas)
})

function autoAmount(o, val, delta, auto, text, divisor) {
  if (!o || !Number.isFinite(o[val]) || o[auto] != null) return
  o[text] = String(o[val])
  if (o[delta] > 0) {
    o[auto] = false
    return
  }
  const d = deltaFromInput(o[text]) || 0
  if (divisor && d >= o[val]) Object.assign(o, { [delta]: 0, [auto]: false })
  else Object.assign(o, { [delta]: d, [auto]: true })
}

export function itemAmountDeltas(item) {
  autoAmount(item, 'amount', 'amountDelta', 'amountDeltaAuto', 'amountText', true)
  for (const u of item.units ?? []) {
    autoAmount(u, 'fromAmount', 'fromDelta', 'fromDeltaAuto', 'fromText', true)
    autoAmount(u, 'toAmount', 'toDelta', 'toDeltaAuto', 'toText', true)
  }
  for (const c of item.components ?? []) autoAmount(c, 'amount', 'amountDelta', 'amountDeltaAuto', 'amountText', false)
  return item
}

export function logAmountDeltas(log) {
  autoAmount(log, 'amount', 'amountDelta', 'amountDeltaAuto', 'amountText', false)
  return log
}

export const TABLES = ['items', 'logs', 'targets', 'config']

/** v1 rows -> v2 rows. Refs `{type, id}` become plain item ids. */
export function migrateV1({ ingredients = [], recipes = [], concoctions = [], conversions = [], logs = [] }) {
  const newId = new Map()
  let next = 1
  for (const [type, rows] of [['ingredient', ingredients], ['recipe', recipes], ['concoction', concoctions]]) {
    for (const r of rows) newId.set(`${type}:${r.id}`, next++)
  }
  const map = (ref) => (ref ? newId.get(`${ref.type}:${ref.id}`) ?? null : null)
  const items = []
  for (const [type, rows] of [['ingredient', ingredients], ['recipe', recipes], ['concoction', concoctions]]) {
    for (const { id, components, ...r } of rows) {
      items.push({
        ...r,
        id: newId.get(`${type}:${id}`),
        components: (components ?? []).map(({ ref, ...c }) => ({ ...c, itemId: map(ref) })),
      })
    }
  }
  return {
    items,
    logs: logs.map(({ item, ...l }) => ({ ...l, itemId: map(item) })),
    conversions: conversions.map(({ ref, ...c }) => ({ ...c, itemId: map(ref) })),
  }
}

export const DEFAULT_CONFIG = {
  dayStart: '05:00',
  dashboard: 'gauges', // 'gauges' (2-column tiles) or 'bars' (one row per nutrient)
}

export async function getConfig() {
  const row = await db.config.get('main')
  return { ...DEFAULT_CONFIG, ...(row?.value ?? {}) }
}

export function saveConfig(value) {
  return db.config.put({ key: 'main', value })
}

// --- Items ---------------------------------------------------------------
// One kind of record. What it "is" follows from its fields, so it can change freely:
//   has madeAt -> concoction, has components -> recipe, otherwise -> ingredient.

export function kindOf(item) {
  if (item?.madeAt) return 'concoction'
  if (item?.components?.length) return 'recipe'
  return 'ingredient'
}

// Name + brand + attributes identify a product (design.md: attributes change the ID).
export function itemKey({ name = '', brand = '', attributes = [] }) {
  const attrs = [...attributes]
    .filter(([k]) => k)
    .map(([k, v]) => `${k.trim().toLowerCase()}=${String(v).trim().toLowerCase()}`)
    .sort()
  return [name.trim().toLowerCase(), brand.trim().toLowerCase(), ...attrs].join('|')
}

export function itemLabel(item) {
  if (!item) return '(missing item)'
  const attrs = (item.attributes ?? []).filter(([k]) => k).map(([k, v]) => `${k}: ${v}`)
  const made = item.madeAt && `— made ${new Date(item.madeAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`
  return [item.name || '(unnamed)', item.brand && `· ${item.brand}`, attrs.length && `(${attrs.join(', ')})`, made]
    .filter(Boolean)
    .join(' ')
}

// --- Import / export -----------------------------------------------------
// JSON has no NaN, so it is encoded as null and decoded back on import.

export async function exportAll() {
  const data = { app: 'food-tracker', version: 6, exportedAt: new Date().toISOString(), tables: {} }
  for (const t of TABLES) data.tables[t] = await db[t].toArray()
  return JSON.stringify(data, (_, v) => (typeof v === 'number' && Number.isNaN(v) ? null : v), 2)
}

// Only nutrient values/deltas use NaN; ids and refs keep null.
function revive(v, key) {
  if (v === null) return key === 'value' || key === 'delta' || key === 'amount' ? NaN : null
  if (Array.isArray(v)) return v.map((x) => revive(x))
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x, k)]))
  return v
}

export async function importAll(text) {
  const data = JSON.parse(text)
  if (data.app !== 'food-tracker') throw new Error('Not a food-tracker export file')
  let tables = revive(data.tables ?? {})
  if ((data.version ?? 1) < 2) tables = { ...tables, ...migrateV1(tables) }
  if ((data.version ?? 1) < 3) tables.items = moveConversions(tables.items ?? [], tables.conversions)
  if ((data.version ?? 1) < 4) {
    const main = (tables.config ?? []).find((r) => r.key === 'main')
    const first = [...(tables.logs ?? [])].sort((a, b) => a.datetime.localeCompare(b.datetime))[0]
    const target = targetFromOldConfig(main?.value, first?.datetime)
    tables.targets = target ? [target] : []
    if (main?.value) delete main.value.targets
  }
  if ((data.version ?? 1) < 5) tables.targets = (tables.targets ?? []).map(targetToRange)
  if ((data.version ?? 1) < 6) {
    tables.items = (tables.items ?? []).map(itemAmountDeltas)
    tables.logs = (tables.logs ?? []).map(logAmountDeltas)
  }
  tables.items = (tables.items ?? []).map(refreshAutoDeltas)
  await db.transaction('rw', TABLES.map((t) => db[t]), async () => {
    for (const t of TABLES) {
      await db[t].clear()
      await db[t].bulkAdd(tables[t] ?? [])
    }
  })
}
