import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { itemLabel } from '../db'
import { amountText, fmt, pmText, rangeText } from '../nutrients'
import { bounds } from '../stats'
import { ROLLING, formatDateTime, prettyDay, toLocalInput } from '../time'
import { MadeTag, Screen, go, replace } from '../components'
import { breakdownMeta, breakdownState, loadBreakdown, makeGroup as groupPicked, quintiles, renameGroup, sum, ungroup as ungroupAll } from '../breakdown'
import { plural, t } from '../i18n'

// One nutrient over a window (from the dashboard): how much each consumption contributed, as horizontal bars
// sorted largest first. Each bar is drawn like the dashboard's fill: solid to the interval's low end, hatched to its
// high end, a white tick at the value. "Quintiles" cuts the ranked list into five groups of whole consumptions, each as
// close as possible to an equal share of what's left (see quintiles()).
// Consumptions can be ticked and grouped: a group is one row (and one unit for the quintiles), in every breakdown.
// The group lives on the consumptions themselves (`log.groupId`, and its optional name in `log.groupName`), so it
// only ever covers those log entries.
// From the "last 7 days" and "last 30 days" dashboards, a "Days" view comes first: one row per day, largest first; a day opens its own
// breakdown, as from the daily dashboard.
// "per 100 kcal" shows every row as its nutrient over its own calories instead (the header: over the window's calories,
// from every consumption). The logic: breakdown.js.

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
  const byDay = !!ROLLING[win] && from !== to
  const perKcal = per === 'kcal' && nutrient !== 'energy'
  const [view, setView] = useState(byDay ? 'days' : 'ranked')
  const [picked, setPicked] = useState(() => new Set()) // entry keys
  const [open, setOpen] = useState(() => new Set()) // groups shown expanded
  const [groupName, setGroupName] = useState('') // for the next group made
  const meta = breakdownMeta(nutrient)

  const data = useLiveQuery(() => loadBreakdown(nutrient, from, to), [nutrient, from, to])

  const when = from === to ? prettyDay(from) : `${from} → ${to}`
  if (!meta?.label) return <Screen title={t('Breakdown')}><p className="muted">{t('Unknown nutrient.')}</p></Screen>
  const explore = <button className="icon" onClick={() => go(`/explore/${nutrient}`)} aria-label={t('Explore')} title={t('Explore')}>🔍</button>
  if (!data) return <Screen title={meta.label} subtitle={when} right={explore} />

  const { rows, dayRows, total, noKcal, shown, dg, scale, dayScale } = breakdownState(data, perKcal)
  const unit = perKcal ? `${meta.unit}/100 kcal` : meta.unit
  const shownView = perKcal && view === 'quintiles' ? 'ranked' : view // quintiles split a total: not for ratios
  const setPer = (on) => replace(`/breakdown/${nutrient}?${new URLSearchParams({ from, to, ...(win && { win }), ...(on && { per: 'kcal' }) })}`)

  const time = (c) => (from === to ? toLocalInput(new Date(c.datetime)).slice(11) : formatDateTime(c.datetime))
  const value = (r) => (
    <span className="bd-value">
      {r.estimated ? '~' : ''}{fmt(r.value, dg)}
      <small> {pmText(r.n)} · {perKcal ? `${fmt(r.e.value, 0)} kcal` : `${total ? fmt((r.value / total) * 100, 0) : 0}%`}</small>
    </span>
  )
  const label = (item) => (item ? <>{itemLabel(item)} <MadeTag item={item} /></> : t('(deleted item)'))
  const toggle = (set, key) => set((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  const tick = (e) => (
    <input type="checkbox" className="bd-tick" aria-label={t('Select')} checked={picked.has(e.key)}
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
        {d.count ? `${plural(d.count, '{n} consumption', '{n} consumptions')} · ${t('range')} ${rangeText(d.n, dg)} ${unit}` : t('No consumption with {nutrient}', { nutrient: meta.label.toLowerCase() })}
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
            {time(r.c)} · {amountText(r.c.amount, r.c.amountText)} {r.c.unit} · {t('range')} {rangeText(r.n, dg)} {unit}
          </span>
        </li>
      )
    }
    const names = [...new Set(e.members.map((r) => (r.item ? itemLabel(r.item) : t('(deleted item)'))))].join(' + ')
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
          {e.name ? names : t('Group of {n}', { n: e.members.length })} · {time({ datetime: times[0] })}{times.length > 1 && times[0] !== times.at(-1) ? `–${time({ datetime: times.at(-1) })}` : ''}
          {' · '}{t('range')} {rangeText(e.n, dg)} {unit}
        </span>
        {expanded && (
          <ul className="bd-members" onClick={(ev) => ev.stopPropagation()}>
            <li className="bd-rename">
              {/* Saved on Enter or when leaving the box; empty goes back to the food names. */}
              <input key={e.name} defaultValue={e.name} placeholder={t('Group name')} aria-label={t('Group name')}
                onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
                onBlur={(ev) => ev.target.value.trim() !== e.name && rename(e.groupId, ev.target.value)} />
            </li>
            {e.members.map((r) => (
              <li key={r.c.id} onClick={() => openFood(r)}>
                <div className="list-main"><span className="bd-name">{label(r.item)}</span>{value(r)}</div>
                <span className="muted small">{time(r.c)} · {amountText(r.c.amount, r.c.amountText)} {r.c.unit}</span>
              </li>
            ))}
            <li className="bd-ungroup"><button className="link" onClick={() => ungroup(e.groupId)}>{t('Ungroup')}</button></li>
          </ul>
        )}
      </li>
    )
  }

  const pickedEntries = rows.filter((e) => picked.has(e.key))
  async function makeGroup() {
    await groupPicked(data.userId, pickedEntries, groupName)
    setPicked(new Set())
    setGroupName('')
  }
  const rename = (groupId, name) => renameGroup(data.userId, groupId, name)
  async function ungroup(groupId) {
    await ungroupAll(data.userId, groupId)
    toggle(setOpen, `g${groupId}`)
  }

  return (
    <Screen title={meta.label} subtitle={when} right={explore}>
      <p className="bd-total">
        <b>{fmt(shown.value, dg)}</b> {unit} {pmText(shown)} <span className="muted">· {t('range')} {rangeText(shown, dg)} {unit}</span>
      </p>
      {nutrient !== 'energy' && (
        <div className="segmented bd-per" role="radiogroup" aria-label={t('Amount')}>
          {[[false, 'Total'], [true, 'per 100 kcal']].map(([v, label]) => (
            <button key={label} role="radio" aria-checked={perKcal === v} className={perKcal === v ? 'on' : ''} onClick={() => setPer(v)}>{t(label)}</button>
          ))}
        </div>
      )}
      <div className="segmented" role="radiogroup" aria-label={t('Grouping')}>
        {[...(byDay ? [['days', 'Days']] : []), ['ranked', 'Ranked'], ...(perKcal ? [] : [['quintiles', 'Quintiles']])].map(([v, label]) => (
          <button key={v} role="radio" aria-checked={shownView === v} className={shownView === v ? 'on' : ''} onClick={() => setView(v)}>{t(label)}</button>
        ))}
      </div>

      {!rows.length && <p className="muted">{t('No consumption with {nutrient} in this period.', { nutrient: meta.label.toLowerCase() })}</p>}
      {shownView === 'days' && rows.length > 0 && <ul className="list bd-list">{dayRows.map(dayRow)}</ul>}
      {shownView === 'quintiles' && quintiles(rows, total).map((g) => (
          <section key={g.name} className="bd-group">
            <h3>
              {g.name}
              <span className="muted"> · {fmt(sum(g.rows, 'value'), 0)} {meta.unit} ({total ? fmt((sum(g.rows, 'value') / total) * 100, 0) : 0}%) · {plural(g.rows.length, '{n} entry', '{n} entries')}</span>
            </h3>
            <ul className="list">{g.rows.map(row)}</ul>
          </section>
        ))}
      {shownView === 'ranked' && <ul className="list bd-list">{rows.map(row)}</ul>}

      {shownView !== 'days' && pickedEntries.length > 0 && (
        <div className="bd-groupbar">
          <input value={groupName} onChange={(ev) => setGroupName(ev.target.value)} placeholder={t('Name (optional)')}
            aria-label={t('Name of the new group')} onKeyDown={(ev) => ev.key === 'Enter' && pickedEntries.length >= 2 && makeGroup()} />
          <span>{t('{n} selected', { n: pickedEntries.length })}</span>
          <button className="secondary" onClick={() => { setPicked(new Set()); setGroupName('') }}>{t('Clear')}</button>
          <button disabled={pickedEntries.length < 2} onClick={makeGroup}>{t('Group')}</button>
        </div>
      )}

      {(data.missing > 0 || data.failed > 0 || noKcal > 0) && (
        <p className="muted small">
          {noKcal > 0 && <>{t('{n} without calories left out.', { n: noKcal })} </>}
          {data.missing > 0 && <>{plural(data.missing, '{n} consumption without {nutrient}.', '{n} consumptions without {nutrient}.', { nutrient: meta.label.toLowerCase() })} </>}
          {data.failed > 0 && <span className="warn">{t("{n} couldn't be computed.", { n: data.failed })}</span>}
        </p>
      )}
    </Screen>
  )
}
