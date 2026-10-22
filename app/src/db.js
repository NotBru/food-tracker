import Dexie from 'dexie'
import { deltaFromInput, isCountUnit } from './nutrients'
import { formatDateTime } from './time'

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

// v10: users. Consumptions and targets belong to a user; foods and config are shared. Existing data goes to a
// default user (see docs/execution/2026-10-15-users.md).
export const DEFAULT_USER = { id: 1, name: 'Default' }
db.version(10)
  .stores({ users: '++id, name', logs: '++id, datetime, [userId+datetime]', targets: '++id, validFrom, userId' })
  .upgrade(async (tx) => {
    await tx.table('users').add({ ...DEFAULT_USER })
    await tx.table('logs').toCollection().modify((l) => { l.userId = DEFAULT_USER.id })
    await tx.table('targets').toCollection().modify((t) => { t.userId = DEFAULT_USER.id })
  })
// A new database starts with the default user too.
db.on('populate', (tx) => tx.table('users').add({ ...DEFAULT_USER }))

// v11: amounts in counted units ("u") default to an exact count: their automatic Δ becomes 0. Explicit Δs stay.
db.version(11).stores({}).upgrade(async (tx) => {
  await tx.table('items').toCollection().modify(countUnitDeltas)
  await tx.table('logs').toCollection().modify(countUnitDeltas)
})

/** Zero the automatic Δ of every amount in "u" (an item's amount, units and components, or a log). Idempotent. */
export function countUnitDeltas(row) {
  const zero = (o, unit, delta, auto) => { if (o && o[auto] && isCountUnit(o[unit])) o[delta] = 0 }
  zero(row, 'unit', 'amountDelta', 'amountDeltaAuto')
  for (const u of row.units ?? []) {
    zero(u, 'fromUnit', 'fromDelta', 'fromDeltaAuto')
    zero(u, 'toUnit', 'toDelta', 'toDeltaAuto')
  }
  for (const c of row.components ?? []) zero(c, 'unit', 'amountDelta', 'amountDeltaAuto')
  return row
}

// v12: foods that are exact repeats (same ID, same values) merge into the oldest one (see
// docs/execution/2026-10-17-duplicate-foods.md).
db.version(12).stores({}).upgrade(async (tx) => {
  const merged = mergeEqualFoods(await tx.table('items').toArray(), await tx.table('logs').toArray())
  if (!merged.removed.length) return
  await tx.table('items').bulkDelete(merged.removed)
  await tx.table('items').bulkPut(merged.items)
  await tx.table('logs').bulkPut(merged.logs)
})

export const TABLES = ['users', 'items', 'logs', 'targets', 'config']

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

// --- Users -----------------------------------------------------------------
// The selected user is its own config row, so saving the Config screen doesn't touch it.

/** The selected user; falls back to the first one if the selection is missing or was deleted. */
export async function getCurrentUser() {
  const id = (await db.config.get('currentUser'))?.value
  return (id != null && (await db.users.get(id))) || (await db.users.orderBy('id').first())
}

export function setCurrentUser(id) {
  return db.config.put({ key: 'currentUser', value: id })
}

/** Deletes a user with their consumptions and targets. The last user can't be deleted. */
export async function deleteUser(id) {
  await db.transaction('rw', db.users, db.logs, db.targets, db.config, async () => {
    if ((await db.users.count()) <= 1) throw new Error('The last user can\'t be deleted.')
    await db.logs.where('userId').equals(id).delete()
    await db.targets.where('userId').equals(id).delete()
    await db.users.delete(id)
    if ((await db.config.get('currentUser'))?.value === id) await db.config.delete('currentUser')
  })
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

// A food's ID is its key plus, for a concoction, when it was made: two batches of the same soup are two foods.
export const foodId = (item) => `${itemKey(item)}|${item.madeAt ?? ''}`

// Everything but the record id and the ID fields themselves (which can differ in case/order and still match).
// NaN is kept apart from null, which JSON.stringify would merge.
function foodValues({ id, name, brand, attributes, madeAt, ...rest }) {
  return JSON.stringify(rest, (_, v) => (typeof v === 'number' && Number.isNaN(v) ? 'NaN' : v))
}

/** Same ID and same values: a repeat of the same entry. */
export const sameFood = (a, b) => foodId(a) === foodId(b) && foodValues(a) === foodValues(b)

/** The oldest food that `rec` repeats exactly, if any (`rec` itself excluded). */
export function findEqualFood(items, rec) {
  return items.filter((it) => it.id !== rec.id && sameFood(it, rec)).sort((a, b) => a.id - b.id)[0]
}

/** ids of foods sharing an ID with a food whose values differ -> the ids of those other foods. */
export function conflictingFoods(items) {
  const byId = new Map()
  for (const it of items) byId.set(foodId(it), [...(byId.get(foodId(it)) ?? []), it])
  const out = new Map()
  for (const group of byId.values()) {
    for (const it of group) {
      const others = group.filter((o) => foodValues(o) !== foodValues(it)).map((o) => o.id)
      if (others.length) out.set(it.id, others)
    }
  }
  return out
}

/**
 * Exact repeats are dropped; consumptions and components that used one point at the oldest copy instead.
 * Returns the rows that remain/changed and the ids removed. Components are compared after repointing, so recipes
 * that only differed by which copy they used become repeats too (hence the loop).
 */
export function mergeEqualFoods(items, logs) {
  let rows = items.map((it) => (it.components ? { ...it, components: it.components.map((c) => ({ ...c })) } : { ...it }))
  logs = logs.map((l) => ({ ...l }))
  const removed = []
  for (;;) {
    const keep = new Map() // foodId + values -> oldest record
    const into = new Map() // removed id -> kept id
    for (const it of [...rows].sort((a, b) => a.id - b.id)) {
      const k = `${foodId(it)}\n${foodValues(it)}`
      if (keep.has(k)) into.set(it.id, keep.get(k).id)
      else keep.set(k, it)
    }
    if (!into.size) break
    removed.push(...into.keys())
    rows = rows.filter((it) => !into.has(it.id))
    for (const it of rows) for (const c of it.components ?? []) if (into.has(c.itemId)) c.itemId = into.get(c.itemId)
    for (const l of logs) if (into.has(l.itemId)) l.itemId = into.get(l.itemId)
  }
  return { items: rows, logs, removed }
}

/** Merges exact repeats in the database (after a food is edited into a copy of another). */
export function mergeEqualFoodsInDb() {
  return db.transaction('rw', db.items, db.logs, async () => {
    const merged = mergeEqualFoods(await db.items.toArray(), await db.logs.toArray())
    if (!merged.removed.length) return
    await db.items.bulkDelete(merged.removed)
    await db.items.bulkPut(merged.items)
    await db.logs.bulkPut(merged.logs)
  })
}

export function itemLabel(item) {
  if (!item) return '(missing item)'
  const attrs = (item.attributes ?? []).filter(([k]) => k).map(([k, v]) => `${k}: ${v}`)
  return [item.name || '(unnamed)', item.brand && `· ${item.brand}`, attrs.length && `(${attrs.join(', ')})`]
    .filter(Boolean)
    .join(' ')
}

/** A concoction's made-at time, shown as a tag beside its label (`MadeTag`), never as part of it. */
export const madeText = (item) => (item?.madeAt ? `made ${formatDateTime(item.madeAt)}` : '')

// A concoction keeps `expiresAfterDays` after it's made. Unset (every food from before it existed) is the default,
// read here rather than stored, so old databases and old exports follow it without a migration.
export const DEFAULT_EXPIRY_DAYS = 7

/** When a concoction expires (ISO time), or null for other foods. */
export function expiresAt(item) {
  if (!item?.madeAt) return null
  const days = item.expiresAfterDays > 0 ? item.expiresAfterDays : DEFAULT_EXPIRY_DAYS
  return new Date(new Date(item.madeAt).getTime() + days * 864e5).toISOString()
}

/**
 * Typed "expires after" days -> stored value: a number > 0, or undefined (blank or not a number: the default). Not
 * null, so the field is dropped (Dexie's update deletes it) and an unset food still matches older copies of itself.
 */
export function parseExpiryDays(text) {
  const d = Number(String(text ?? '').trim().replace(',', '.'))
  return String(text ?? '').trim() && d > 0 ? d : undefined
}

/** What food searches match: the label, plus the made-at time so a batch can be found by its date. */
export const searchText = (item) => `${itemLabel(item)} ${madeText(item)}`.toLowerCase()

// --- Import / export -----------------------------------------------------
// JSON has no NaN, so it is encoded as null and decoded back on import.

export async function exportAll() {
  const data = { app: 'food-tracker', version: 7, exportedAt: new Date().toISOString(), tables: {} }
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
  if ((data.version ?? 1) < 7) {
    tables.users = [{ ...DEFAULT_USER }]
    for (const t of ['logs', 'targets']) tables[t] = (tables[t] ?? []).map((r) => ({ ...r, userId: DEFAULT_USER.id }))
  }
  if (!tables.users?.length) tables.users = [{ ...DEFAULT_USER }]
  tables.items = (tables.items ?? []).map(refreshAutoDeltas).map(countUnitDeltas)
  tables.logs = (tables.logs ?? []).map(countUnitDeltas)
  const merged = mergeEqualFoods(tables.items, tables.logs)
  tables.items = merged.items
  tables.logs = merged.logs
  await db.transaction('rw', TABLES.map((t) => db[t]), async () => {
    for (const t of TABLES) {
      await db[t].clear()
      await db[t].bulkAdd(tables[t] ?? [])
    }
  })
}
