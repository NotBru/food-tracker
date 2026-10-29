// Three-way merge of this device's data with the backup's, against the copy both last agreed on (the base), for
// backup.js. Tables are in export form (JSON: NaN as null). Rows are matched by id (config's by key).
//
// Per row: changed on one side only -> that side's; changed the same on both -> that; changed differently on both
// (deleted on one side counts) -> a conflict, for the user to pick; this device's stays meanwhile. A row deleted on one
// side but still used on the other (a consumption of a deleted food, say) stays.
//
// No imports, so Node can use it too (the log-food skill's tool syncs like a device): the tables are those given.

// Which user is selected is this device's own.
const LOCAL = new Set(['config:currentUser'])

/** Object keys sorted: the same row written in another order compares equal. */
const canon = (row) => JSON.stringify(row, (_, v) =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v)

const keyOf = (t, r) => (t === 'config' ? r.key : r.id)

/** "table:key" -> {t, key, row, text}. */
function index(tables) {
  const m = new Map()
  for (const [t, rows] of Object.entries(tables ?? {})) {
    for (const row of rows ?? []) {
      const k = `${t}:${keyOf(t, row)}`
      if (!LOCAL.has(k)) m.set(k, { t, key: keyOf(t, row), row, text: canon(row) })
    }
  }
  return m
}

/** The fields two versions of a row disagree on (for showing a conflict). */
export function differingFields(a, b) {
  return [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])]
    .filter((f) => f !== 'id' && canon(a?.[f] ?? null) !== canon(b?.[f] ?? null))
}

/** How many rows differ between two copies. */
export function changes(a, b) {
  const x = index(a)
  const y = index(b)
  let n = 0
  for (const [k, r] of y) if (x.get(k)?.text !== r.text) n++
  for (const k of x.keys()) if (!y.has(k)) n++
  return n
}

// The rows a row uses ("table:id"); reference foods ("ciqual:…", "fdc:…") aren't rows.
function uses(t, r) {
  const refs = t === 'logs' ? [`users:${r.userId}`, `items:${r.itemId}`]
    : t === 'targets' || t === 'weights' ? [`users:${r.userId}`]
      : t === 'items' ? (r.components ?? []).map((c) => `items:${c.itemId}`) : []
  return refs.filter((k) => k.split(':').length === 2)
}

/**
 * The backup's changes since the base, for this device: `writes` [{t, key, row}] (row null: delete it here) and
 * `conflicts` [{t, key, local, cloud}] (null: deleted on that side).
 */
export function merge(base, local, cloud) {
  const b = index(base)
  const l = index(local)
  const c = index(cloud)
  const writes = new Map()
  const conflicts = new Map()
  const result = new Map(l) // what this device holds after the writes
  for (const k of new Set([...b.keys(), ...l.keys(), ...c.keys()])) {
    const [bt, lt, ct] = [b.get(k)?.text, l.get(k)?.text, c.get(k)?.text]
    if (lt === ct || ct === bt) continue
    const { t, key } = b.get(k) ?? l.get(k) ?? c.get(k)
    if (lt === bt) {
      writes.set(k, { t, key, row: c.get(k)?.row ?? null })
      if (c.has(k)) result.set(k, c.get(k))
      else result.delete(k)
    } else conflicts.set(k, { t, key, local: l.get(k)?.row ?? null, cloud: c.get(k)?.row ?? null })
  }
  // Rows still used stay: back from the backup's copy (deleted here), or kept here (deleted there).
  for (let again = true; again;) {
    again = false
    for (const r of [...result.values()]) {
      for (const k of uses(r.t, r.row)) {
        if (result.has(k)) continue
        const kept = l.get(k) ?? c.get(k) ?? b.get(k)
        if (!kept) continue // never there: nothing to bring back
        result.set(k, kept)
        conflicts.delete(k)
        if (l.has(k)) writes.delete(k)
        else writes.set(k, { t: kept.t, key: kept.key, row: kept.row })
        again = true
      }
    }
  }
  return { writes: [...writes.values()], conflicts: [...conflicts.values()] }
}
