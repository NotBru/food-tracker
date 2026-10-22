import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getConfig, getCurrentUser, itemLabel } from '../db'
import { consumptionNutrients, loadContext, resolve } from '../calc'
import { NUTRIENTS, amountText, calories, fmt, pmText, rangeText } from '../nutrients'
import { addScaled, bounds, variance, zero } from '../stats'
import { addDays, dayBounds, formatDateTime, logicalDay, prettyDay, toLocalInput } from '../time'
import { MadeTag, Screen, go, replace } from '../components'
import { ROWS } from './Home'

// One nutrient over a window (from the dashboard): how much each consumption contributed, as horizontal bars
// sorted largest first. Each bar is drawn like the dashboard's fill: solid to the interval's low end, hatched to its
// high end, a white tick at the value. "Quintiles" cuts the ranked list into five groups of whole consumptions, each as
// close as possible to an equal share of what's left (see quintiles()).
// Consumptions can be ticked and grouped: a group is one row (and one unit for the quintiles), in every breakdown.
// The group lives on the consumptions themselves (`log.groupId`, and its optional name in `log.groupName`), so it
// only ever covers those log entries.
// From the "last 7 days" dashboard, a "Days" view comes first: one row per day, largest first; a day opens its own
// breakdown, as from the daily dashboard.
// "per 100 kcal" shows every row as its nutrient over its own calories instead (the header: over the window's calories,
// from every consumption); see per100().

const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0)

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
function quintiles(rows, total) {
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

function Bar({ r, scale, cls }) {
  const pct = (x) => `${Math.max(0, Math.min(100, (x / scale) * 100))}%`
  const [lo, hi] = bounds(r.n)
  const err = hi > lo
  return (
    <div className={`bd-bar ${cls}`}>
      <div className="bar-fill" style={{ left: 0, width: pct(err ? lo : r.value) }} />
      {err && <div className="bar-err" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />}
      {err && <div className="bar-mean" style={{ left: pct(r.value) }} />}
    </div>
  )
}

export default function Breakdown({ nutrient, from, to, win, per }) {
  const byDay = win === 'last7' && from !== to
  const perKcal = per === 'kcal' && nutrient !== 'energy'
  const [view, setView] = useState(byDay ? 'days' : 'ranked')
  const [picked, setPicked] = useState(() => new Set()) // entry keys
  const [open, setOpen] = useState(() => new Set()) // groups shown expanded
  const [groupName, setGroupName] = useState('') // for the next group made
  const meta = ROWS.find((r) => r.key === nutrient) ?? { ...NUTRIENTS.find((n) => n.key === nutrient), cls: '' }

  const data = useLiveQuery(async () => {
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
  }, [nutrient, from, to])

  const when = from === to ? prettyDay(from) : `${from} → ${to}`
  if (!meta?.label) return <Screen title="Breakdown"><p className="muted">Unknown nutrient.</p></Screen>
  const explore = <button className="icon" onClick={() => go(`/explore/${nutrient}`)} aria-label="Explore" title="Explore">🔍</button>
  if (!data) return <Screen title={meta.label} subtitle={when} right={explore} />

  const totalN = data.rows.reduce((t, r) => addScaled(t, r.n), zero())
  const total = totalN.value
  // per 100 kcal: entries (and group members) without calories are left out; everything is re-ranked by the ratio.
  const largestFirst = (a, b) => b.value - a.value
  const asRatio = (x) => { const n = per100(x.n, x.e); return { ...x, n, value: n.value } }
  const rows = perKcal
    ? data.rows.filter((r) => r.e.value > 0).map((r) => ({ ...asRatio(r), members: r.members.filter((m) => m.e.value > 0).map(asRatio).sort(largestFirst) })).sort(largestFirst)
    : data.rows
  const noKcal = perKcal ? data.rows.length - rows.length : 0
  const dayRows = data.days.map((d) => (perKcal ? asRatio(d) : { ...d, value: d.n.value })).sort((a, b) => largestFirst(a, b) || (a.day < b.day ? 1 : -1))
  const shown = perKcal ? per100(totalN, data.totalE) : totalN
  const unit = perKcal ? `${meta.unit}/100 kcal` : meta.unit
  const dg = perKcal ? 1 : 0 // digits
  const scale = Math.max(...rows.map((r) => bounds(r.n)[1]), perKcal ? 0 : 1) || 1
  const dayScale = Math.max(...dayRows.map((d) => bounds(d.n)[1]), perKcal ? 0 : 1) || 1
  const shownView = perKcal && view === 'quintiles' ? 'ranked' : view // quintiles split a total: not for ratios
  const setPer = (on) => replace(`/breakdown/${nutrient}?${new URLSearchParams({ from, to, ...(win && { win }), ...(on && { per: 'kcal' }) })}`)

  const time = (c) => (from === to ? toLocalInput(new Date(c.datetime)).slice(11) : formatDateTime(c.datetime))
  const value = (r) => (
    <span className="bd-value">
      {r.estimated ? '~' : ''}{fmt(r.value, dg)}
      <small> {pmText(r.n)} · {perKcal ? `${fmt(r.e.value, 0)} kcal` : `${total ? fmt((r.value / total) * 100, 0) : 0}%`}</small>
    </span>
  )
  const label = (item) => (item ? <>{itemLabel(item)} <MadeTag item={item} /></> : '(deleted item)')
  const toggle = (set, key) => set((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  const tick = (e) => (
    <input type="checkbox" className="bd-tick" aria-label="Select" checked={picked.has(e.key)}
      onClick={(ev) => ev.stopPropagation()} onChange={() => toggle(setPicked, e.key)} />
  )
  // Opens the consumption's info; its link to the food keeps this nutrient (components ranked by it).
  const openFood = (r) => go(`/consumptions/${r.c.id}?nutrient=${nutrient}`)

  const dayRow = (d) => (
    <li key={d.day} onClick={() => go(`/breakdown/${nutrient}?from=${d.day}&to=${d.day}${perKcal ? '&per=kcal' : ''}`)}>
      <div className="list-main">
        <span className="bd-name">{prettyDay(d.day)}</span>
        {value(d)}
      </div>
      <Bar r={d} scale={dayScale} cls={meta.cls} />
      <span className="muted small">
        {d.count ? `${d.count} consumption${d.count === 1 ? '' : 's'} · range ${rangeText(d.n, dg)} ${unit}` : `No consumption with ${meta.label.toLowerCase()}`}
      </span>
    </li>
  )

  const row = (e) => {
    if (e.groupId == null) {
      const r = e.members[0]
      return (
        <li key={e.key} onClick={() => openFood(r)}>
          <div className="list-main">
            <span className="bd-name">{tick(e)}{label(r.item)}</span>
            {value(r)}
          </div>
          <Bar r={r} scale={scale} cls={meta.cls} />
          <span className="muted small">
            {time(r.c)} · {amountText(r.c.amount, r.c.amountText)} {r.c.unit} · range {rangeText(r.n, dg)} {unit}
          </span>
        </li>
      )
    }
    const names = [...new Set(e.members.map((r) => (r.item ? itemLabel(r.item) : '(deleted item)')))].join(' + ')
    const times = e.members.map((r) => r.c.datetime).sort()
    const expanded = open.has(e.key)
    return (
      <li key={e.key} className="bd-grouprow" onClick={() => toggle(setOpen, e.key)}>
        <div className="list-main">
          <span className="bd-name">{tick(e)}<span className="bd-chev">{expanded ? '▾' : '▸'}</span>{e.name || names}</span>
          {value(e)}
        </div>
        <Bar r={e} scale={scale} cls={meta.cls} />
        <span className="muted small">
          {e.name ? names : `Group of ${e.members.length}`} · {time({ datetime: times[0] })}{times.length > 1 && times[0] !== times.at(-1) ? `–${time({ datetime: times.at(-1) })}` : ''}
          {' · '}range {rangeText(e.n, dg)} {unit}
        </span>
        {expanded && (
          <ul className="bd-members" onClick={(ev) => ev.stopPropagation()}>
            <li className="bd-rename">
              {/* Saved on Enter or when leaving the box; empty goes back to the food names. */}
              <input key={e.name} defaultValue={e.name} placeholder="Group name" aria-label="Group name"
                onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
                onBlur={(ev) => ev.target.value.trim() !== e.name && rename(e.groupId, ev.target.value)} />
            </li>
            {e.members.map((r) => (
              <li key={r.c.id} onClick={() => openFood(r)}>
                <div className="list-main"><span className="bd-name">{label(r.item)}</span>{value(r)}</div>
                <span className="muted small">{time(r.c)} · {amountText(r.c.amount, r.c.amountText)} {r.c.unit}</span>
              </li>
            ))}
            <li className="bd-ungroup"><button className="link" onClick={() => ungroup(e.groupId)}>Ungroup</button></li>
          </ul>
        )}
      </li>
    )
  }

  // Ticked entries -> one new group. Ticked groups are merged in whole, members outside this window included.
  const pickedEntries = rows.filter((e) => picked.has(e.key))
  // The name typed in the bar, or else that of a ticked group (the largest named one).
  async function makeGroup() {
    const group = { groupId: newGroupId(), groupName: groupName.trim() || pickedEntries.find((e) => e.name)?.name || '' }
    if (!group.groupName) delete group.groupName
    const oldGroups = new Set(pickedEntries.filter((e) => e.groupId != null).map((e) => e.groupId))
    const lone = pickedEntries.filter((e) => e.groupId == null).map((e) => e.members[0].c.id)
    const set = (l) => { delete l.groupName; Object.assign(l, group) }
    await db.transaction('rw', db.logs, async () => {
      if (oldGroups.size) await groupMembers(data.userId, oldGroups).modify(set)
      await db.logs.where('id').anyOf(lone).modify(set)
    })
    setPicked(new Set())
    setGroupName('')
  }
  async function rename(groupId, name) {
    name = name.trim()
    await groupMembers(data.userId, new Set([groupId])).modify((l) => { if (name) l.groupName = name; else delete l.groupName })
  }
  async function ungroup(groupId) {
    await groupMembers(data.userId, new Set([groupId])).modify((l) => { delete l.groupId; delete l.groupName })
    toggle(setOpen, `g${groupId}`)
  }

  return (
    <Screen title={meta.label} subtitle={when} right={explore}>
      <p className="bd-total">
        <b>{fmt(shown.value, dg)}</b> {unit} {pmText(shown)} <span className="muted">· range {rangeText(shown, dg)} {unit}</span>
      </p>
      {nutrient !== 'energy' && (
        <div className="segmented bd-per" role="radiogroup" aria-label="Amount">
          {[[false, 'Total'], [true, 'per 100 kcal']].map(([v, label]) => (
            <button key={label} role="radio" aria-checked={perKcal === v} className={perKcal === v ? 'on' : ''} onClick={() => setPer(v)}>{label}</button>
          ))}
        </div>
      )}
      <div className="segmented" role="radiogroup" aria-label="Grouping">
        {[...(byDay ? [['days', 'Days']] : []), ['ranked', 'Ranked'], ...(perKcal ? [] : [['quintiles', 'Quintiles']])].map(([v, label]) => (
          <button key={v} role="radio" aria-checked={shownView === v} className={shownView === v ? 'on' : ''} onClick={() => setView(v)}>{label}</button>
        ))}
      </div>

      {!rows.length && <p className="muted">No consumption with {meta.label.toLowerCase()} in this period.</p>}
      {shownView === 'days' && rows.length > 0 && <ul className="list bd-list">{dayRows.map(dayRow)}</ul>}
      {shownView === 'quintiles' && quintiles(rows, total).map((g) => (
          <section key={g.name} className="bd-group">
            <h3>
              {g.name}
              <span className="muted"> · {fmt(sum(g.rows, 'value'), 0)} {meta.unit} ({total ? fmt((sum(g.rows, 'value') / total) * 100, 0) : 0}%) · {g.rows.length} {g.rows.length === 1 ? 'entry' : 'entries'}</span>
            </h3>
            <ul className="list">{g.rows.map(row)}</ul>
          </section>
        ))}
      {shownView === 'ranked' && <ul className="list bd-list">{rows.map(row)}</ul>}

      {shownView !== 'days' && pickedEntries.length > 0 && (
        <div className="bd-groupbar">
          <input value={groupName} onChange={(ev) => setGroupName(ev.target.value)} placeholder="Name (optional)"
            aria-label="Name of the new group" onKeyDown={(ev) => ev.key === 'Enter' && pickedEntries.length >= 2 && makeGroup()} />
          <span>{pickedEntries.length} selected</span>
          <button className="secondary" onClick={() => { setPicked(new Set()); setGroupName('') }}>Clear</button>
          <button disabled={pickedEntries.length < 2} onClick={makeGroup}>Group</button>
        </div>
      )}

      {(data.missing > 0 || data.failed > 0 || noKcal > 0) && (
        <p className="muted small">
          {noKcal > 0 && <>{noKcal} without calories left out. </>}
          {data.missing > 0 && <>{data.missing} consumption{data.missing === 1 ? '' : 's'} without {meta.label.toLowerCase()}. </>}
          {data.failed > 0 && <span className="warn">{data.failed} couldn't be computed.</span>}
        </p>
      )}
    </Screen>
  )
}
