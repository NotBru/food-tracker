import { db, getConfig, getCurrentUser } from './db'
import { consumptionNutrients, loadContext, resolve } from './calc'
import { NUTRIENTS, calories } from './nutrients'
import { addScaled, bounds, variance, zero } from './stats'
import { addDays, dayBounds, logicalDay } from './time'
import { ROWS } from './dashboard'

// Breakdown's logic (screens/Breakdown.jsx; the Android app's native screen too): one nutrient over a window, per
// consumption (or group of them), per day, or in quintiles; grouping consumptions.

export const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0)

/** The nutrient's dashboard row (its colour class) or NUTRIENTS entry; `label` missing if unknown. */
export const breakdownMeta = (nutrient) => ROWS.find((r) => r.key === nutrient) ?? { ...NUTRIENTS.find((n) => n.key === nutrient), cls: '' }

/** Per-consumption rows -> entries, largest first: lone consumptions, plus one entry per group adding up its members
 * (also largest first). Each has the nutrient as `n` ({value, v, s}), its `value` and its calories `e`. */
function groupRows(rows) {
  const entries = []
  const groups = new Map()
  for (const r of rows) {
    if (r.c.groupId == null) { entries.push({ key: `c${r.c.id}`, members: [r], n: r.n, e: r.e, value: r.value, estimated: r.estimated }); continue }
    let g = groups.get(r.c.groupId)
    if (!g) {
      g = { key: `g${r.c.groupId}`, groupId: r.c.groupId, name: r.c.groupName ?? '', members: [], n: zero(), e: zero(), value: 0, estimated: false }
      groups.set(r.c.groupId, g)
      entries.push(g)
    }
    g.members.push(r)
    addScaled(g.n, r.n)
    addScaled(g.e, r.e)
    g.value = g.n.value
    g.estimated ||= r.estimated
  }
  for (const g of groups.values()) g.members.sort((a, b) => b.value - a.value)
  return entries.sort((a, b) => b.value - a.value)
}

/**
 * `a` per 100 kcal of `e`. Its deviation combines both relative errors as if they were independent: the shared
 * structure of a ratio isn't modelled, so the interval is approximate (wider than it should be where a food's nutrient
 * and calories err together). Nothing (0) when either is 0.
 */
function per100(a, e) {
  if (!(a.value > 0 && e.value > 0)) return zero()
  const value = (a.value / e.value) * 100
  return { value, v: value * value * (variance(a) / a.value ** 2 + variance(e) / e.value ** 2), s: {} }
}

// Not crypto.randomUUID: it needs a secure context, and the app is also served over plain http (serve.sh).
const newGroupId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** All of this user's consumptions in any of these groups, in or out of the window shown. */
const groupMembers = (userId, groupIds) => db.logs.where('userId').equals(userId).filter((l) => groupIds.has(l.groupId))

const QUINTILE_NAMES = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']

/**
 * Ranked rows (largest first) -> 5 consecutive groups. The cuts are decided from the top: each group takes the
 * number of rows whose sum is closest to its target, what's still left divided by the groups still to fill
 * (ties: fewer rows). Recomputing the target stops a big group near the top starving the bottom ones. Every group gets at least one row while
 * there are enough to go round (one left for each group still to come); the last group takes the rest. Groups
 * left empty (fewer than 5 rows) are dropped.
 */
export function quintiles(rows, total) {
  const groups = []
  let i = 0
  let rest = total
  for (let q = 0; q < 5 && i < rows.length; q++) {
    const target = rest / (5 - q)
    const left = rows.length - i
    let take = left
    if (q < 4) {
      const maxTake = Math.max(1, left - (4 - q))
      let best = Infinity
      let acc = 0
      for (let k = 1; k <= maxTake; k++) {
        acc += rows[i + k - 1].value
        const err = Math.abs(acc - target)
        if (err < best) { best = err; take = k }
      }
    }
    groups.push({ name: QUINTILE_NAMES[q], rows: rows.slice(i, i + take) })
    rest -= sum(groups[q].rows, 'value')
    i += take
  }
  return groups
}

/** The window's consumptions with the nutrient, as entries (groupRows), and every day's sums. */
export async function loadBreakdown(nutrient, from, to) {
  const config = await getConfig()
  const start = dayBounds(from, config.dayStart)[0]
  const end = dayBounds(to, config.dayStart)[1]
  const user = await getCurrentUser()
  const logs = await db.logs.where('[userId+datetime]').between([user.id, start.toISOString()], [user.id, end.toISOString()], true, false).toArray()
  const ctx = await loadContext()
  const rows = []
  const days = {} // logical day -> every consumption of it with this nutrient, summed
  for (let d = from; d <= to; d = addDays(d, 1)) days[d] = { day: d, n: zero(), e: zero(), count: 0 }
  const totalE = zero() // every consumption's calories, with this nutrient or not
  let failed = 0
  let missing = 0
  for (const c of logs) {
    const res = consumptionNutrients(ctx, c)
    if (!res.ok) { failed++; continue }
    const e = calories(res.nutrients)
    const d = days[logicalDay(c.datetime, config.dayStart)]
    addScaled(totalE, e)
    if (d) addScaled(d.e, e)
    const n = nutrient === 'energy' ? e : res.nutrients[nutrient]
    if (!n || !Number.isFinite(n.value) || n.value <= 0) { missing++; continue }
    rows.push({ c, item: resolve(ctx, c.itemId), n, e, value: n.value, estimated: !!n.estimated })
    if (d) { addScaled(d.n, n); d.count++; d.estimated ||= !!n.estimated }
  }
  return { rows: groupRows(rows), days: Object.values(days), totalE, failed, missing, userId: user.id }
}

/**
 * What's shown of `data` (loadBreakdown), in total or per 100 kcal (`perKcal`): the entries and days ranked, the
 * total, its unit and digits, the bars' scales. Per 100 kcal, entries (and group members) without calories are left
 * out (`noKcal` of them) and everything is re-ranked by the ratio.
 */
export function breakdownState(data, perKcal) {
  const totalN = data.rows.reduce((t, r) => addScaled(t, r.n), zero())
  const largestFirst = (a, b) => b.value - a.value
  const asRatio = (x) => { const n = per100(x.n, x.e); return { ...x, n, value: n.value } }
  const rows = perKcal
    ? data.rows.filter((r) => r.e.value > 0).map((r) => ({ ...asRatio(r), members: r.members.filter((m) => m.e.value > 0).map(asRatio).sort(largestFirst) })).sort(largestFirst)
    : data.rows
  const dayRows = data.days.map((d) => (perKcal ? asRatio(d) : { ...d, value: d.n.value })).sort((a, b) => largestFirst(a, b) || (a.day < b.day ? 1 : -1))
  return {
    rows, dayRows,
    total: totalN.value,
    noKcal: perKcal ? data.rows.length - rows.length : 0,
    shown: perKcal ? per100(totalN, data.totalE) : totalN,
    dg: perKcal ? 1 : 0, // digits
    scale: Math.max(...rows.map((r) => bounds(r.n)[1]), perKcal ? 0 : 1) || 1,
    dayScale: Math.max(...dayRows.map((d) => bounds(d.n)[1]), perKcal ? 0 : 1) || 1,
  }
}

/**
 * Ticked entries -> one new group. Ticked groups are merged in whole, members outside this window included. Its
 * name: `name` typed, or else that of a ticked group (the largest named one).
 */
export async function makeGroup(userId, pickedEntries, name) {
  const group = { groupId: newGroupId(), groupName: name.trim() || pickedEntries.find((e) => e.name)?.name || '' }
  if (!group.groupName) delete group.groupName
  const oldGroups = new Set(pickedEntries.filter((e) => e.groupId != null).map((e) => e.groupId))
  const lone = pickedEntries.filter((e) => e.groupId == null).map((e) => e.members[0].c.id)
  const set = (l) => { delete l.groupName; Object.assign(l, group) }
  await db.transaction('rw', db.logs, async () => {
    if (oldGroups.size) await groupMembers(userId, oldGroups).modify(set)
    await db.logs.where('id').anyOf(lone).modify(set)
  })
}

/** A group's name; empty goes back to the food names. */
export async function renameGroup(userId, groupId, name) {
  name = name.trim()
  await groupMembers(userId, new Set([groupId])).modify((l) => { if (name) l.groupName = name; else delete l.groupName })
}

export async function ungroup(userId, groupId) {
  await groupMembers(userId, new Set([groupId])).modify((l) => { delete l.groupId; delete l.groupName })
}
