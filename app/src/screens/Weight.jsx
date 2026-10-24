import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { db, getConfig, getCurrentUser } from '../db'
import { consumptionNutrients, loadContext, sumNutrients } from '../calc'
import { calories, fmt, normalizeNumber, pmText, rangeText } from '../nutrients'
import { addDays, dayBounds, formatDateTime, logicalDay, toLocalInput } from '../time'
import { DateTimeInput, Field, Screen, replace, useToday } from '../components'
import { KCAL_PER_KG, MAINT_DAYS, MIN_SPAN, MIN_WEIGH_INS, dailyWeights, maintenance, weekWeight } from '../weight'

// Weigh-ins, newest first, and what they say about maintenance calories (weight.js).

export default function Weight({ add }) {
  const day = useToday()
  const data = useLiveQuery(async () => {
    if (!day) return null
    const config = await getConfig()
    const user = await getCurrentUser()
    const weighIns = await db.weights.where('[userId+datetime]').between([user.id, Dexie.minKey], [user.id, Dexie.maxKey]).reverse().toArray()
    const daily = dailyWeights(weighIns, config.dayStart)
    // Calories per day over the estimate's window.
    const from = dayBounds(addDays(day, -(MAINT_DAYS - 1)), config.dayStart)[0]
    const end = dayBounds(day, config.dayStart)[1]
    const logs = await db.logs.where('[userId+datetime]').between([user.id, from.toISOString()], [user.id, end.toISOString()], true, false).toArray()
    const ctx = await loadContext()
    const byDay = {}
    for (const l of logs) (byDay[logicalDay(l.datetime, config.dayStart)] ??= []).push(consumptionNutrients(ctx, l).nutrients)
    const eaten = Object.fromEntries(Object.entries(byDay).map(([d, ns]) => [d, calories(sumNutrients(ns))]))
    return { user, weighIns, week: weekWeight(daily, day), maint: maintenance(daily, eaten, day) }
  }, [day])
  const [editing, setEditing] = useState(null)
  // A new weigh-in is now, starting from the last one's weight.
  const newWeighIn = () => setEditing({ datetime: new Date().toISOString(), userId: data.user.id, kg: data.weighIns[0]?.kg })
  // Opened with ?new (the homescreen's +): straight into a new weigh-in, once; the flag leaves the URL.
  const added = useRef(false)
  useEffect(() => {
    if (!add || !data || added.current) return
    added.current = true
    newWeighIn()
    replace('/weight')
  }, [add, data])

  if (!data) return null
  const { user, weighIns, week, maint } = data
  return (
    <Screen title="Weight" subtitle={user.name}>
      <section className="weight-sum">
        <p>
          <span className="muted">7-day average · </span>
          {week ? <><b>{fmt(week.value, 1)}</b> kg {week.v > 0 && <span className="muted">{pmText(week)}</span>}</> : <span className="muted">no weigh-ins this week</span>}
        </p>
        <Maintenance maint={maint} />
      </section>
      <ul className="list">
        <li className="add" onClick={newWeighIn}>+ add weigh-in</li>
        {weighIns.map((w) => (
          <li key={w.id} onClick={() => setEditing(w)}>
            <div className="list-main">
              <b>{w.kg} kg</b>
              <span className="muted">{formatDateTime(w.datetime)}</span>
            </div>
          </li>
        ))}
      </ul>
      {editing && <WeighInEditor weighIn={editing} onClose={() => setEditing(null)} />}
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

function WeighInEditor({ weighIn, onClose }) {
  const [kg, setKg] = useState(weighIn.kg != null ? String(weighIn.kg) : '')
  const [datetime, setDatetime] = useState(toLocalInput(new Date(weighIn.datetime)))
  async function save() {
    const value = Number(normalizeNumber(kg.replace(',', '.')))
    if (!(value > 0)) return alert('Type a weight in kg.')
    const rec = { userId: weighIn.userId, datetime: new Date(datetime).toISOString(), kg: value }
    if (weighIn.id) await db.weights.update(weighIn.id, rec)
    else await db.weights.add(rec)
    onClose()
  }
  async function remove() {
    if (confirm('Delete this weigh-in?')) {
      await db.weights.delete(weighIn.id)
      onClose()
    }
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{weighIn.id ? 'Edit weigh-in' : 'New weigh-in'}</h2>
        <Field label="Weight (kg)">
          <input autoFocus inputMode="decimal" value={kg} enterKeyHint="done" onFocus={(e) => e.target.select()}
            onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <Field label="Time">
          <DateTimeInput value={datetime} onChange={setDatetime} />
        </Field>
        <div className="row actions">
          {weighIn.id && <button className="danger" onClick={remove}>Delete</button>}
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
