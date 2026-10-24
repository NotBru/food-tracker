import { measure } from './nutrients'
import { addScaled, zero } from './stats'
import { addDays, daysBetween, logicalDay } from './time'

// Body measurements: {userId, datetime, values: {field: {value, text, delta, auto}}, extra: [{label, unit, value, text,
// delta, auto}]}, per user like consumptions (table `weights`, its name from when it held only weight). `values` has
// the built-in fields; `extra`, any other measurement, named per entry like a food's attributes. Each value keeps its
// ± Δ as an amount does (nutrients.js `measure`: typed, or from the digits), read as a uniform error, σ = Δ/√3. An
// entry holds any of them.
// A day's value is the mean of that logical day's measurements. Day-to-day swings (water, and a home scale's body
// fat) are larger than real change, so what's read is the 7-day average and the trend over weeks.

// Built-in fields. `minRange`: the least a chart's scale spans.
export const BUILTIN_FIELDS = [
  { key: 'kg', label: 'Weight', unit: 'kg', minRange: 2, short: 'kg' },
  { key: 'bodyFat', label: 'Body fat', unit: '%', minRange: 2, short: '% fat' },
  { key: 'muscle', label: 'Muscle mass', unit: 'kg', minRange: 2, short: 'kg muscle' },
  { key: 'waist', label: 'Waist', unit: 'cm', minRange: 4, short: 'cm waist', hint: 'at the navel, relaxed, breathing out' },
]

const uniformVar = (d) => (Math.abs(d) || 0) ** 2 / 3

/** One field's value in an entry as {value, v} (v: its variance), or null. */
export function fieldValue(entry, key) {
  const m = entry.values?.[key]
  return m && Number.isFinite(m.value) ? { value: m.value, v: uniformVar(m.delta) } : null
}

/**
 * Lean mass, weight less fat: kg × (1 − fat/100), from an entry with both. Its variance by propagation:
 * (1 − f/100)² σkg² + (kg/100)² σf².
 */
function leanValue(entry) {
  const kg = fieldValue(entry, 'kg')
  const f = fieldValue(entry, 'bodyFat')
  if (!kg || !f) return null
  return { value: kg.value * (1 - f.value / 100), v: (1 - f.value / 100) ** 2 * kg.v + (kg.value / 100) ** 2 * f.v }
}

// --- Extra measurements ---------------------------------------------------------
// Named per entry. Names that differ only in case, accents or spacing are the same measurement.

/** A name as compared: lower case, no accents, single spaces. */
export const nameKey = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')

/** Every extra measurement used in `rows`: [{key, label, unit}], each with its first spelling and latest unit, most
 * used first. (The editor saves a known name with its known spelling, so they rarely differ.) */
export function extraNames(rows) {
  const out = new Map()
  for (const r of [...rows].sort((a, b) => a.datetime.localeCompare(b.datetime))) {
    for (const x of r.extra ?? []) {
      const key = nameKey(x.label)
      if (!key) continue
      const had = out.get(key)
      out.set(key, { key, label: had?.label ?? x.label.trim(), unit: x.unit || had?.unit || '', count: (had?.count ?? 0) + 1 })
    }
  }
  return [...out.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/** Edit distance (insertions, deletions, substitutions, swaps of neighbours). */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/**
 * A known name `label` looks like a typo of: not the same name, but within 1 edit (names up to 5 letters) or 2,
 * or one is the other plus a letter-less ending ("waist2"). The closest, or null.
 */
export function lookalike(label, known) {
  const k = nameKey(label)
  if (!k || known.some((n) => n.key === k)) return null
  const strip = (s) => s.replace(/[^\p{L}]/gu, '')
  let best = null
  for (const n of known) {
    const dist = distance(k, n.key)
    const near = dist <= (Math.min(k.length, n.key.length) <= 5 ? 1 : 2) || (strip(k) && strip(k) === strip(n.key))
    if (near && (!best || dist < best.dist)) best = { ...n, dist }
  }
  return best
}

/** Known names for what's typed: those containing it first, then those it looks like a typo of. All when blank. */
export function nameMatches(text, known) {
  const q = nameKey(text)
  if (!q) return known
  const near = lookalike(text, known)
  return [...known.filter((n) => n.key.includes(q)), ...(near && !near.key.includes(q) ? [near] : [])]
}

/** One extra measurement's value in an entry as {value, v}, or null. */
function extraValue(entry, key) {
  const x = (entry.extra ?? []).find((e) => nameKey(e.label) === key)
  return x && Number.isFinite(x.value) ? { value: x.value, v: uniformVar(x.delta) } : null
}

/** Every measure, in order: weight, body fat, lean mass (from those two), muscle, waist, then the extra ones in `rows`. */
export function measures(rows = []) {
  const field = (f) => ({ ...f, of: (e) => fieldValue(e, f.key) })
  const [kg, fat, muscle, waist] = BUILTIN_FIELDS.map(field)
  const lean = { key: 'lean', label: 'Lean mass', unit: 'kg', minRange: 2, derived: true, of: leanValue }
  const extra = extraNames(rows).map((n) => ({ key: `x:${n.key}`, label: n.label, unit: n.unit, of: (e) => extraValue(e, n.key) }))
  return [kg, fat, lean, muscle, waist, ...extra]
}

/** An old entry's numbers (`kg`, `bodyFat`, `waist` on the row, before values had errors) -> `values`, Δ from the
 * digits. Idempotent. */
export function bodyValues(row) {
  for (const k of ['kg', 'bodyFat', 'waist']) {
    if (typeof row[k] !== 'number') continue
    row.values ??= {}
    row.values[k] = measure(String(row[k]), '')
    delete row[k]
  }
  return row
}

/** Values of the short-lived shared custom fields (config `bodyFields` [{key, label, unit}], values under their key)
 * -> the entry's `extra`. Idempotent. */
export function fieldsToExtra(row, fields = []) {
  for (const f of fields) {
    const m = row.values?.[f.key]
    if (!m) continue
    row.extra = [...(row.extra ?? []), { label: f.label, unit: f.unit ?? '', ...m }]
    delete row.values[f.key]
  }
  return row
}

// kcal in a kg of body weight lost or gained (mostly fat, some lean tissue and water): the usual rule of thumb.
export const KCAL_PER_KG = 7700
// The maintenance estimate looks at the last MAINT_DAYS days; it needs MIN_WEIGH_INS days with a weigh-in, at
// least MIN_SPAN days apart (first to last).
export const MAINT_DAYS = 28
export const MIN_WEIGH_INS = 4
export const MIN_SPAN = 7

/**
 * Logical day -> that day's value of `of`: the mean of its measurements, as {value, v, s} (stats.js), v the variance
 * of that mean from their errors (Σσ²/n²).
 */
export function dailyValues(rows, of, dayStart) {
  const byDay = {}
  for (const r of rows) {
    const x = of(r)
    if (x) (byDay[logicalDay(r.datetime, dayStart)] ??= []).push(x)
  }
  return Object.fromEntries(Object.entries(byDay).map(([d, xs]) => [d, {
    value: xs.reduce((a, x) => a + x.value, 0) / xs.length,
    v: xs.reduce((a, x) => a + x.v, 0) / xs.length ** 2,
    s: {},
  }]))
}

/**
 * The 7-day average on day `d`: the mean of the days among d−6..d with a value, as {value, v, s}. Its variance is the
 * larger of two estimates of the mean's error: the days' spread² / n (which holds the measurement errors and the
 * day-to-day swings), and the measurements' own errors (Σσ²/n²). The spread needs two days and is shaky with few;
 * with one day there is only the measurement's error. None: null.
 */
export function weekMean(daily, d) {
  const ks = [0, 1, 2, 3, 4, 5, 6].map((i) => daily[addDays(d, -i)]).filter(Boolean)
  if (!ks.length) return null
  const n = ks.length
  const mean = ks.reduce((a, k) => a + k.value, 0) / n
  const spread = n > 1 ? ks.reduce((a, k) => a + (k.value - mean) ** 2, 0) / (n - 1) / n : 0
  const own = ks.reduce((a, k) => a + k.v, 0) / n ** 2
  return { value: mean, v: Math.max(spread, own), s: {} }
}

/**
 * Maintenance calories from weight and intake, over the MAINT_DAYS days up to `last`:
 *   maintenance = mean logged kcal per day − trend (kg/day) × KCAL_PER_KG.
 * The trend is the least-squares line through the days' weights; its error, the line's standard error, from the
 * scatter about the line or, if larger, the weigh-ins' own errors. The intake
 * is the per-day mean over the days with consumptions from the first weigh-in to the day before the last (a
 * weigh-in, in the morning, comes before that day's food), with its own error. Both errors add.
 * `daily`: logical day -> weight (dailyValues). `eaten`: logical day -> calories ({value, v, s}). Returns `{need}`
 * instead when there is too little to go on.
 */
export function maintenance(daily, eaten, last, days = MAINT_DAYS) {
  const from = addDays(last, -(days - 1))
  const pts = Object.entries(daily).filter(([d]) => d >= from && d <= last).sort(([a], [b]) => a.localeCompare(b))
  const span = pts.length ? daysBetween(pts[0][0], pts.at(-1)[0]) : 0
  if (pts.length < MIN_WEIGH_INS || span < MIN_SPAN) return { need: { weighIns: pts.length, span } }
  const xs = pts.map(([d]) => daysBetween(pts[0][0], d))
  const ys = pts.map(([, k]) => k.value)
  const n = xs.length
  const mx = xs.reduce((a, x) => a + x, 0) / n
  const my = ys.reduce((a, y) => a + y, 0) / n
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx
  const rss = xs.reduce((a, x, i) => a + (ys[i] - my - slope * (x - mx)) ** 2, 0)
  const own = pts.reduce((a, [, k]) => a + k.v, 0) / n
  const trend = { value: slope, v: Math.max(rss / (n - 2), own) / sxx, s: {} }

  const logged = []
  for (let d = pts[0][0]; d < pts.at(-1)[0]; d = addDays(d, 1)) if (eaten[d]) logged.push(eaten[d])
  if (!logged.length) return { need: { logged: 0 } }
  const intake = zero()
  for (const e of logged) addScaled(intake, e, 1 / logged.length)

  const value = addScaled(addScaled(zero(), intake), trend, -KCAL_PER_KG)
  return {
    value,
    intake,
    trend, // kg/day
    weighIns: n,
    from: pts[0][0],
    to: pts.at(-1)[0],
    loggedDays: logged.length,
    days: span,
  }
}
