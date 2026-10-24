import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { db, getConfig, getCurrentUser } from '../db'
import { consumptionNutrients, loadContext, sumNutrients } from '../calc'
import { calories, deltaText, fmt, measure, pmText, rangeText } from '../nutrients'
import { addDays, dayBounds, formatDateTime, logicalDay, toLocalInput } from '../time'
import { DateTimeInput, DeltaInput, Screen, enterSaves, pressable, replace, useListNav, useToday } from '../components'
import { BUILTIN_FIELDS, KCAL_PER_KG, MAINT_DAYS, MIN_SPAN, MIN_WEIGH_INS, dailyValues, extraNames, fieldValue, lookalike, maintenance, measures, nameKey, nameMatches, weekMean } from '../body'

// Body measurements (weight, body fat, muscle, waist, and any other named per entry), each with its ± Δ, newest
// first; the 7-day averages, and what weight says about maintenance calories (body.js).

/** "78.1 kg · 18.5% fat · 84 cm waist · Neck 38 cm": what one entry holds, each value as typed. */
function entryText(entry) {
  const pm = (m) => (m.auto ? '' : ` ±${m.delta}`)
  return [
    ...BUILTIN_FIELDS.filter((f) => entry.values?.[f.key]).map((f) => `${entry.values[f.key].text}${pm(entry.values[f.key])} ${f.short}`),
    ...(entry.extra ?? []).map((x) => `${x.label} ${x.text}${pm(x)} ${x.unit ?? ''}`.trim()),
  ].join(' · ')
}

export default function Body({ add }) {
  const day = useToday()
  const data = useLiveQuery(async () => {
    if (!day) return null
    const config = await getConfig()
    const user = await getCurrentUser()
    const rows = await db.weights.where('[userId+datetime]').between([user.id, Dexie.minKey], [user.id, Dexie.maxKey]).reverse().toArray()
    // Each measure's 7-day average today, for those ever measured.
    const weeks = measures(rows).filter((m) => rows.some((r) => m.of(r)))
      .map((m) => ({ ...m, week: weekMean(dailyValues(rows, m.of, config.dayStart), day) }))
    // Calories per day over the estimate's window.
    const from = dayBounds(addDays(day, -(MAINT_DAYS - 1)), config.dayStart)[0]
    const end = dayBounds(day, config.dayStart)[1]
    const logs = await db.logs.where('[userId+datetime]').between([user.id, from.toISOString()], [user.id, end.toISOString()], true, false).toArray()
    const ctx = await loadContext()
    const byDay = {}
    for (const l of logs) (byDay[logicalDay(l.datetime, config.dayStart)] ??= []).push(consumptionNutrients(ctx, l).nutrients)
    const eaten = Object.fromEntries(Object.entries(byDay).map(([d, ns]) => [d, calories(sumNutrients(ns))]))
    const weight = dailyValues(rows, (e) => fieldValue(e, 'kg'), config.dayStart)
    return { user, rows, known: extraNames(rows), weeks, maint: maintenance(weight, eaten, day) }
  }, [day])
  const [editing, setEditing] = useState(null)
  const newEntry = () => setEditing({ datetime: new Date().toISOString(), userId: data.user.id, values: {} })
  // Opened with ?new (the homescreen's +): straight into a new entry, once; the flag leaves the URL.
  const added = useRef(false)
  useEffect(() => {
    if (!add || !data || added.current) return
    added.current = true
    newEntry()
    replace('/body')
  }, [add, data])

  if (!data) return null
  const { user, rows, known, weeks, maint } = data
  // A new entry's fields show the last value of each as a hint.
  const lastOf = Object.fromEntries(BUILTIN_FIELDS.map((f) => [f.key, rows.find((r) => r.values?.[f.key])?.values[f.key].text]))
  return (
    <Screen title="Body measurements" subtitle={user.name}>
      <section className="weight-sum">
        <p className="muted small">7-day averages</p>
        {weeks.map((m) => (
          <p key={m.key}>
            <span className="muted">{m.label} · </span>
            {m.week ? <><b>{fmt(m.week.value, 1)}</b> {m.unit} {m.week.v > 0 && <span className="muted">{pmText(m.week)}</span>}</> : <span className="muted">none this week</span>}
          </p>
        ))}
        <Maintenance maint={maint} />
      </section>
      <ul className="list">
        <li className="add" onClick={newEntry}>+ add measurements</li>
        {rows.map((r) => (
          <li key={r.id} onClick={() => setEditing(r)}>
            <div className="list-main">
              <b>{entryText(r)}</b>
              <span className="muted nowrap">{formatDateTime(r.datetime)}</span>
            </div>
          </li>
        ))}
      </ul>
      {editing && <EntryEditor entry={editing} known={known} last={lastOf} onClose={() => setEditing(null)} />}
    </Screen>
  )
}

/** Maintenance kcal: the estimate with its interval and where it comes from, or what's still missing. */
function Maintenance({ maint }) {
  if (maint.need) {
    const { weighIns = 0, span = 0, logged } = maint.need
    return (
      <p className="muted">
        Maintenance: needs {logged === 0 ? 'consumptions logged between the weigh-ins' : `weigh-ins on ${MIN_WEIGH_INS}+ days, at least ${MIN_SPAN} days apart, in the last ${MAINT_DAYS} (so far ${weighIns} over ${span} day${span === 1 ? '' : 's'})`}.
        {' '}Weigh in every morning; it gets sharper with weeks.
      </p>
    )
  }
  const { value, intake, trend, weighIns, from, to, loggedDays, days } = maint
  const perWeek = { ...trend, value: trend.value * 7, v: trend.v * 49 }
  return (
    <>
      <p>
        <span className="muted">Maintenance ≈ </span><b className="c-kcal">{fmt(value.value, 0)}</b> kcal/day
        <span className="muted"> ({rangeText(value)})</span>
      </p>
      <p className="muted small">
        Logged {fmt(intake.value, 0)} kcal/day ({loggedDays} of {days} days logged) and the weight went
        {' '}{perWeek.value >= 0 ? '+' : '−'}{fmt(Math.abs(perWeek.value), 2)} kg/week ±{fmt(Math.sqrt(perWeek.v), 2)} ({weighIns} weigh-ins, {from} → {to}):
        {' '}{fmt(intake.value, 0)} {trend.value >= 0 ? '−' : '+'} {fmt(Math.abs(trend.value) * KCAL_PER_KG, 0)} kcal/day at {KCAL_PER_KG} kcal per kg.
      </p>
    </>
  )
}

/**
 * An entry: a value and ± Δ per built-in field (blank Δ: from the digits), any other measurement added like an
 * attribute (name, value, ± Δ, unit), any left blank but not all, and a time. Names are looked up among those used
 * before as they're typed; saving a name that looks like a typo of a known one asks first.
 */
function EntryEditor({ entry, known, last, onClose }) {
  const [texts, setTexts] = useState(Object.fromEntries(BUILTIN_FIELDS.map((f) => {
    const m = entry.values?.[f.key]
    return [f.key, { value: m?.text ?? '', delta: m ? deltaText(m.delta, m.auto) : '' }]
  })))
  const set = (key, part) => (v) => setTexts({ ...texts, [key]: { ...texts[key], [part]: v } })
  const [extra, setExtra] = useState((entry.extra ?? []).map((x) => ({ label: x.label, unit: x.unit ?? '', value: x.text, delta: deltaText(x.delta, x.auto) })))
  const setX = (i, part) => (v) => setExtra(extra.map((x, j) => (j === i ? { ...x, [part]: v } : x)))
  const [datetime, setDatetime] = useState(toLocalInput(new Date(entry.datetime)))
  const refs = useRef([])
  const num = (t) => t.trim().replace(',', '.')
  async function save() {
    const values = {}
    for (const f of BUILTIN_FIELDS) {
      const t = texts[f.key]
      if (!t.value.trim()) continue
      const m = measure(num(t.value), num(t.delta))
      if (!Number.isFinite(m.value)) return alert(`${f.label}: not a number.`)
      values[f.key] = m
    }
    const out = []
    for (const x of extra) {
      if (!x.label.trim() && !x.value.trim()) continue
      if (!x.label.trim()) return alert('A measurement needs a name.')
      const m = measure(num(x.value), num(x.delta))
      if (!Number.isFinite(m.value)) return alert(`${x.label}: not a number.`)
      // A known name keeps its spelling; one that looks like a typo of a known one asks.
      let match = known.find((n) => n.key === nameKey(x.label))
      if (!match) {
        const near = lookalike(x.label, known)
        if (near && confirm(`“${x.label.trim()}” looks like “${near.label}”. Use “${near.label}”?\n(Cancel keeps “${x.label.trim()}” as a new measurement.)`)) match = near
      }
      const label = match?.label ?? x.label.trim()
      if (out.some((o) => nameKey(o.label) === nameKey(label))) return alert(`${label} is in twice.`)
      // A blank unit takes the known measurement's.
      out.push({ label, unit: x.unit.trim() || match?.unit || '', ...m })
    }
    if (!Object.keys(values).length && !out.length) return alert('Type at least one measurement.')
    const rec = { userId: entry.userId, datetime: new Date(datetime).toISOString(), values, ...(out.length && { extra: out }) }
    await db.weights.put(entry.id ? { ...rec, id: entry.id } : rec)
    onClose()
  }
  async function remove() {
    if (confirm('Delete these measurements?')) {
      await db.weights.delete(entry.id)
      onClose()
    }
  }
  // Enter moves to the next field's value; on the last, saves.
  const onKey = (i) => (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (refs.current[i + 1]) refs.current[i + 1].focus()
    else save()
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} onKeyDown={enterSaves(save)}>
        <h2>{entry.id ? 'Edit measurements' : 'New measurements'}</h2>
        <div className="nutrients">
          <div className="n-row n-head"><span /><span>value</span><span>± Δ</span></div>
          {BUILTIN_FIELDS.map((f, i) => (
            <div className="n-row" key={f.key}>
              <span>
                {f.label} <small className="muted">{f.unit}</small>
                {f.hint && <small className="muted body-hint">{f.hint}</small>}
              </span>
              <input ref={(el) => (refs.current[i] = el)} autoFocus={i === 0} inputMode="decimal" value={texts[f.key].value}
                placeholder={!entry.id && last[f.key] ? last[f.key] : ''} aria-label={f.label}
                enterKeyHint={i < BUILTIN_FIELDS.length - 1 ? 'next' : 'done'} onKeyDown={onKey(i)} onChange={(e) => set(f.key, 'value')(e.target.value)} />
              <DeltaInput value={texts[f.key].delta} amount={texts[f.key].value} onChange={set(f.key, 'delta')} />
            </div>
          ))}
          {extra.length > 0 && <div className="n-row body-extra n-head"><span>name</span><span>unit</span><span>value</span><span>± Δ</span><span /></div>}
          {extra.map((x, i) => (
            <div className="n-row body-extra" key={i}>
              <NameCombo value={x.label} known={known} onChange={setX(i, 'label')}
                onPick={(n) => setExtra(extra.map((y, j) => (j === i ? { ...y, label: n.label, unit: y.unit || n.unit } : y)))} />
              <input value={x.unit} placeholder="unit" aria-label="Unit" autoCapitalize="none" onChange={(e) => setX(i, 'unit')(e.target.value)} />
              <input inputMode="decimal" value={x.value} aria-label="Value" onChange={(e) => setX(i, 'value')(e.target.value)} />
              <DeltaInput value={x.delta} amount={x.value} onChange={setX(i, 'delta')} />
              <button className="icon small" onClick={() => setExtra(extra.filter((_, j) => j !== i))} aria-label="Remove">×</button>
            </div>
          ))}
          <button type="button" className="link" {...pressable(() => setExtra([...extra, { label: '', unit: '', value: '', delta: '' }]), { focusOnClick: true })}>+ measurement</button>
        </div>
        <label className="field">
          <span>Time</span>
          <DateTimeInput value={datetime} onChange={setDatetime} />
        </label>
        <div className="row actions">
          {entry.id && <button className="danger" onClick={remove}>Delete</button>}
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}

/**
 * A measurement's name: free text, with the names used before listed under it as it's typed (those containing it,
 * then one it looks like a typo of, "did you mean"). Picking one takes its spelling, and its unit if none is set.
 */
function NameCombo({ value, known, onChange, onPick }) {
  const [open, setOpen] = useState(false)
  const matches = nameMatches(value, known).filter((n) => n.key !== nameKey(value) || n.label !== value.trim())
  const near = nameKey(value) && !known.some((n) => n.key === nameKey(value)) ? lookalike(value, known) : null
  const nav = useListNav(matches.length, (i) => { onPick(matches[i]); setOpen(false) }, () => setOpen(false))
  return (
    <div className="picker">
      <input value={value} placeholder="name" aria-label="Name" autoComplete="off"
        onFocus={() => { setOpen(true); nav.reset() }} onBlur={() => setOpen(false)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); nav.reset() }} {...nav.inputProps} />
      {open && matches.length > 0 && (
        <ul className="picker-list" ref={nav.listRef}>
          {matches.map((n, i) => (
            <li key={n.key} {...nav.itemProps(i)}>
              {near?.key === n.key && <small className="muted">did you mean </small>}{n.label}
              {n.unit && <small className="muted"> · {n.unit}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
