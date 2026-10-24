import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { db, getConfig, getCurrentUser } from '../db'
import { consumptionNutrients, loadContext, sumNutrients } from '../calc'
import { calories, fmt, normalizeNumber, pmText, rangeText } from '../nutrients'
import { addDays, dayBounds, formatDateTime, logicalDay, toLocalInput } from '../time'
import { DateTimeInput, Field, Screen, replace, useToday } from '../components'
import { FIELDS, KCAL_PER_KG, MAINT_DAYS, MEASURES, MIN_SPAN, MIN_WEIGH_INS, dailyMeans, maintenance, weekMean } from '../body'

// Body measurements (weight, body fat, waist), newest first; the 7-day averages, and what weight says about
// maintenance calories (body.js).

const byKey = Object.fromEntries(MEASURES.map((m) => [m.key, m]))
/** "78.1 kg · 18.5% fat · 84 cm waist": what one entry holds. */
const entryText = (m) => [m.kg != null && `${m.kg} kg`, m.bodyFat != null && `${m.bodyFat}% fat`, m.waist != null && `${m.waist} cm waist`]
  .filter(Boolean).join(' · ')

export default function Body({ add }) {
  const day = useToday()
  const data = useLiveQuery(async () => {
    if (!day) return null
    const config = await getConfig()
    const user = await getCurrentUser()
    const rows = await db.weights.where('[userId+datetime]').between([user.id, Dexie.minKey], [user.id, Dexie.maxKey]).reverse().toArray()
    // Each measure's 7-day average today, for those ever measured.
    const weeks = MEASURES.map((m) => ({ ...m, week: weekMean(dailyMeans(rows, m.of, config.dayStart), day) }))
      .filter((m) => rows.some((r) => m.of(r) != null))
    // Calories per day over the estimate's window.
    const from = dayBounds(addDays(day, -(MAINT_DAYS - 1)), config.dayStart)[0]
    const end = dayBounds(day, config.dayStart)[1]
    const logs = await db.logs.where('[userId+datetime]').between([user.id, from.toISOString()], [user.id, end.toISOString()], true, false).toArray()
    const ctx = await loadContext()
    const byDay = {}
    for (const l of logs) (byDay[logicalDay(l.datetime, config.dayStart)] ??= []).push(consumptionNutrients(ctx, l).nutrients)
    const eaten = Object.fromEntries(Object.entries(byDay).map(([d, ns]) => [d, calories(sumNutrients(ns))]))
    return { user, rows, weeks, maint: maintenance(dailyMeans(rows, byKey.kg.of, config.dayStart), eaten, day) }
  }, [day])
  const [editing, setEditing] = useState(null)
  const newEntry = () => setEditing({ datetime: new Date().toISOString(), userId: data.user.id })
  // Opened with ?new (the homescreen's +): straight into a new entry, once; the flag leaves the URL.
  const added = useRef(false)
  useEffect(() => {
    if (!add || !data || added.current) return
    added.current = true
    newEntry()
    replace('/body')
  }, [add, data])

  if (!data) return null
  const { user, rows, weeks, maint } = data
  // A new entry's fields show the last value of each as a hint.
  const lastOf = Object.fromEntries(FIELDS.map((f) => [f, rows.find((r) => r[f] != null)?.[f]]))
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
      {editing && <EntryEditor entry={editing} last={lastOf} onClose={() => setEditing(null)} />}
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

// The fields of an entry: any may be left blank, but not all.
const INPUTS = [
  { key: 'kg', label: 'Weight (kg)', max: 500 },
  { key: 'bodyFat', label: 'Body fat (%)', max: 75 },
  { key: 'waist', label: 'Waist (cm)', max: 300, hint: 'at the navel, relaxed, breathing out' },
]

function EntryEditor({ entry, last, onClose }) {
  const [texts, setTexts] = useState(Object.fromEntries(INPUTS.map((f) => [f.key, entry[f.key] != null ? String(entry[f.key]) : ''])))
  const [datetime, setDatetime] = useState(toLocalInput(new Date(entry.datetime)))
  const refs = useRef([])
  async function save() {
    const rec = { userId: entry.userId, datetime: new Date(datetime).toISOString() }
    for (const f of INPUTS) {
      const t = texts[f.key].trim()
      if (!t) continue
      const x = Number(normalizeNumber(t.replace(',', '.')))
      if (!(x > 0 && x < f.max)) return alert(`${f.label}: not a measurement.`)
      rec[f.key] = x
    }
    if (!FIELDS.some((k) => rec[k] != null)) return alert('Type at least one measurement.')
    // put, not update: a field cleared is gone.
    await db.weights.put(entry.id ? { ...rec, id: entry.id } : rec)
    onClose()
  }
  async function remove() {
    if (confirm('Delete these measurements?')) {
      await db.weights.delete(entry.id)
      onClose()
    }
  }
  // Enter moves to the next field; on the last, saves.
  const onKey = (i) => (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (refs.current[i + 1]) refs.current[i + 1].focus()
    else save()
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{entry.id ? 'Edit measurements' : 'New measurements'}</h2>
        {INPUTS.map((f, i) => (
          <Field key={f.key} label={f.label}>
            <input ref={(el) => (refs.current[i] = el)} autoFocus={i === 0} inputMode="decimal" value={texts[f.key]}
              placeholder={[last[f.key] != null && !entry.id && `last ${last[f.key]}`, f.hint].filter(Boolean).join(' · ')}
              enterKeyHint={i < INPUTS.length - 1 ? 'next' : 'done'} onKeyDown={onKey(i)}
              onChange={(e) => setTexts({ ...texts, [f.key]: e.target.value })} />
          </Field>
        ))}
        <Field label="Time">
          <DateTimeInput value={datetime} onChange={setDatetime} />
        </Field>
        <div className="row actions">
          {entry.id && <button className="danger" onClick={remove}>Delete</button>}
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
