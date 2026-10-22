import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getConfig, getCurrentUser, itemLabel } from '../db'
import { consumptionNutrients, loadContext, resolve } from '../calc'
import { NUTRIENTS, amountText, calories, fmt, pmText, rangeText } from '../nutrients'
import { addScaled, bounds, zero } from '../stats'
import { dayBounds, formatDateTime, prettyDay, toLocalInput } from '../time'
import { MadeTag, Screen, go } from '../components'
import { ROWS } from './Home'

// One nutrient over a window (from the dashboard): how much each consumption contributed, as horizontal bars
// sorted largest first. Each bar is drawn like the dashboard's fill: solid to the interval's low end, hatched to its
// high end, a white tick at the value. "Quintiles" cuts the ranked list into five groups of whole consumptions, each as
// close as possible to an equal share of what's left (see quintiles()).
// Consumptions can be ticked and grouped: a group is one row (and one unit for the quintiles), in every breakdown.
// The group lives on the consumptions themselves (`log.groupId`, and its optional name in `log.groupName`), so it
// only ever covers those log entries.

const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0)

/** Per-consumption rows -> entries, largest first: lone consumptions, plus one entry per group adding up its members
 * (also largest first). Each has the nutrient as `n` ({value, v, s}) and its `value`. */
function groupRows(rows) {
  const entries = []
  const groups = new Map()
  for (const r of rows) {
    if (r.c.groupId == null) { entries.push({ key: `c${r.c.id}`, members: [r], n: r.n, value: r.value, estimated: r.estimated }); continue }
    let g = groups.get(r.c.groupId)
    if (!g) {
      g = { key: `g${r.c.groupId}`, groupId: r.c.groupId, name: r.c.groupName ?? '', members: [], n: zero(), value: 0, estimated: false }
      groups.set(r.c.groupId, g)
      entries.push(g)
    }
    g.members.push(r)
    addScaled(g.n, r.n)
    g.value = g.n.value
    g.estimated ||= r.estimated
  }
  for (const g of groups.values()) g.members.sort((a, b) => b.value - a.value)
  return entries.sort((a, b) => b.value - a.value)
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

export default function Breakdown({ nutrient, from, to }) {
  const [grouped, setGrouped] = useState(false)
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
    let failed = 0
    let missing = 0
    for (const c of logs) {
      const res = consumptionNutrients(ctx, c)
      if (!res.ok) { failed++; continue }
      const n = nutrient === 'energy' ? calories(res.nutrients) : res.nutrients[nutrient]
      if (!n || !Number.isFinite(n.value) || n.value <= 0) { missing++; continue }
      rows.push({ c, item: resolve(ctx, c.itemId), n, value: n.value, estimated: !!n.estimated })
    }
    return { rows: groupRows(rows), failed, missing, userId: user.id }
  }, [nutrient, from, to])

  const when = from === to ? prettyDay(from) : `${from} → ${to}`
  if (!meta?.label) return <Screen title="Breakdown"><p className="muted">Unknown nutrient.</p></Screen>
  const explore = <button className="icon" onClick={() => go(`/explore/${nutrient}`)} aria-label="Explore" title="Explore">🔍</button>
  if (!data) return <Screen title={meta.label} subtitle={when} right={explore} />

  const { rows } = data
  const totalN = rows.reduce((t, r) => addScaled(t, r.n), zero())
  const total = totalN.value
  const scale = Math.max(...rows.map((r) => bounds(r.n)[1]), 1)

  const time = (c) => (from === to ? toLocalInput(new Date(c.datetime)).slice(11) : formatDateTime(c.datetime))
  const value = (r) => (
    <span className="bd-value">
      {r.estimated ? '~' : ''}{fmt(r.value, 0)}
      <small> {pmText(r.n)} · {total ? fmt((r.value / total) * 100, 0) : 0}%</small>
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
            {time(r.c)} · {amountText(r.c.amount, r.c.amountText)} {r.c.unit} · range {rangeText(r.n)} {meta.unit}
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
          {' · '}range {rangeText(e.n)} {meta.unit}
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
        <b>{fmt(total, 0)}</b> {meta.unit} {pmText(totalN)} <span className="muted">· range {rangeText(totalN)} {meta.unit}</span>
      </p>
      <div className="segmented" role="radiogroup" aria-label="Grouping">
        {[[false, 'Ranked'], [true, 'Quintiles']].map(([v, label]) => (
          <button key={label} role="radio" aria-checked={grouped === v} className={grouped === v ? 'on' : ''} onClick={() => setGrouped(v)}>{label}</button>
        ))}
      </div>

      {!rows.length && <p className="muted">No consumption with {meta.label.toLowerCase()} in this period.</p>}
      {grouped
        ? quintiles(rows, total).map((g) => (
          <section key={g.name} className="bd-group">
            <h3>
              {g.name}
              <span className="muted"> · {fmt(sum(g.rows, 'value'), 0)} {meta.unit} ({total ? fmt((sum(g.rows, 'value') / total) * 100, 0) : 0}%) · {g.rows.length} {g.rows.length === 1 ? 'entry' : 'entries'}</span>
            </h3>
            <ul className="list">{g.rows.map(row)}</ul>
          </section>
        ))
        : <ul className="list bd-list">{rows.map(row)}</ul>}

      {pickedEntries.length > 0 && (
        <div className="bd-groupbar">
          <input value={groupName} onChange={(ev) => setGroupName(ev.target.value)} placeholder="Name (optional)"
            aria-label="Name of the new group" onKeyDown={(ev) => ev.key === 'Enter' && pickedEntries.length >= 2 && makeGroup()} />
          <span>{pickedEntries.length} selected</span>
          <button className="secondary" onClick={() => { setPicked(new Set()); setGroupName('') }}>Clear</button>
          <button disabled={pickedEntries.length < 2} onClick={makeGroup}>Group</button>
        </div>
      )}

      {(data.missing > 0 || data.failed > 0) && (
        <p className="muted small">
          {data.missing > 0 && <>{data.missing} consumption{data.missing === 1 ? '' : 's'} without {meta.label.toLowerCase()}. </>}
          {data.failed > 0 && <span className="warn">{data.failed} couldn't be computed.</span>}
        </p>
      )}
    </Screen>
  )
}
