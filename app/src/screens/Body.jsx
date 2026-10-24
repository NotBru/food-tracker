import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { db, getBodyFields, getConfig, getCurrentUser, saveBodyFields } from '../db'
import { consumptionNutrients, loadContext, sumNutrients } from '../calc'
import { calories, deltaText, fmt, measure, pmText, rangeText } from '../nutrients'
import { addDays, dayBounds, formatDateTime, logicalDay, toLocalInput } from '../time'
import { DateTimeInput, DeltaInput, Screen, TrashIcon, replace, useToday } from '../components'
import { KCAL_PER_KG, MAINT_DAYS, MIN_SPAN, MIN_WEIGH_INS, dailyValues, fieldValue, inputFields, maintenance, measures, newFieldKey, weekMean } from '../body'

// Body measurements (weight, body fat, muscle, waist, and the user's own fields), each with its ± Δ, newest first;
// the 7-day averages, and what weight says about maintenance calories (body.js).

/** "78.1 kg · 18.5% fat · 84 cm waist · Neck 38 cm": what one entry holds, each value as typed. */
function entryText(entry, fields) {
  return fields.filter((f) => entry.values?.[f.key]).map((f) => {
    const m = entry.values[f.key]
    const pm = m.auto ? '' : ` ±${m.delta}`
    return f.short ? `${m.text}${pm} ${f.short}` : `${f.label} ${m.text}${pm} ${f.unit}`.trim()
  }).join(' · ')
}

export default function Body({ add }) {
  const day = useToday()
  const data = useLiveQuery(async () => {
    if (!day) return null
    const config = await getConfig()
    const user = await getCurrentUser()
    const custom = await getBodyFields()
    const rows = await db.weights.where('[userId+datetime]').between([user.id, Dexie.minKey], [user.id, Dexie.maxKey]).reverse().toArray()
    // Each measure's 7-day average today, for those ever measured.
    const weeks = measures(custom).filter((m) => rows.some((r) => m.of(r)))
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
    return { user, custom, rows, weeks, maint: maintenance(weight, eaten, day) }
  }, [day])
  const [editing, setEditing] = useState(null)
  const [fieldsOpen, setFieldsOpen] = useState(false)
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
  const { user, custom, rows, weeks, maint } = data
  const fields = inputFields(custom)
  // A new entry's fields show the last value of each as a hint.
  const lastOf = Object.fromEntries(fields.map((f) => [f.key, rows.find((r) => r.values?.[f.key])?.values[f.key].text]))
  return (
    <Screen title="Body measurements" subtitle={user.name}
      right={<button className="icon" onClick={() => setFieldsOpen(true)} aria-label="Fields">⚙️</button>}>
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
              <b>{entryText(r, fields)}</b>
              <span className="muted nowrap">{formatDateTime(r.datetime)}</span>
            </div>
          </li>
        ))}
      </ul>
      {editing && <EntryEditor entry={editing} fields={fields} last={lastOf} onClose={() => setEditing(null)} />}
      {fieldsOpen && <FieldsEditor custom={custom} onClose={() => setFieldsOpen(false)} />}
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

/** An entry: a value and ± Δ per field (blank Δ: from the digits), any left blank but not all, and a time. */
function EntryEditor({ entry, fields, last, onClose }) {
  const [texts, setTexts] = useState(Object.fromEntries(fields.map((f) => {
    const m = entry.values?.[f.key]
    return [f.key, { value: m?.text ?? '', delta: m ? deltaText(m.delta, m.auto) : '' }]
  })))
  const set = (key, part) => (v) => setTexts({ ...texts, [key]: { ...texts[key], [part]: v } })
  const [datetime, setDatetime] = useState(toLocalInput(new Date(entry.datetime)))
  const refs = useRef([])
  async function save() {
    const values = {}
    for (const f of fields) {
      const t = texts[f.key]
      if (!t.value.trim()) continue
      const m = measure(t.value.trim().replace(',', '.'), t.delta.trim().replace(',', '.'))
      if (!Number.isFinite(m.value)) return alert(`${f.label}: not a number.`)
      values[f.key] = m
    }
    if (!Object.keys(values).length) return alert('Type at least one measurement.')
    // A field this list doesn't show (a custom field since removed) is kept.
    const kept = Object.fromEntries(Object.entries(entry.values ?? {}).filter(([k]) => !fields.some((f) => f.key === k)))
    const rec = { userId: entry.userId, datetime: new Date(datetime).toISOString(), values: { ...kept, ...values } }
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
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{entry.id ? 'Edit measurements' : 'New measurements'}</h2>
        <div className="nutrients">
          <div className="n-row n-head"><span /><span>value</span><span>± Δ</span></div>
          {fields.map((f, i) => (
            <div className="n-row" key={f.key}>
              <span>
                {f.label} <small className="muted">{f.unit}</small>
                {f.hint && <small className="muted body-hint">{f.hint}</small>}
              </span>
              <input ref={(el) => (refs.current[i] = el)} autoFocus={i === 0} inputMode="decimal" value={texts[f.key].value}
                placeholder={!entry.id && last[f.key] ? last[f.key] : ''} aria-label={f.label}
                enterKeyHint={i < fields.length - 1 ? 'next' : 'done'} onKeyDown={onKey(i)} onChange={(e) => set(f.key, 'value')(e.target.value)} />
              <DeltaInput value={texts[f.key].delta} amount={texts[f.key].value} onChange={set(f.key, 'delta')} />
            </div>
          ))}
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

/** The user's own fields: a name and a unit each; added, renamed, removed (with their values, after asking). */
function FieldsEditor({ custom, onClose }) {
  const [rows, setRows] = useState(custom.map((f) => ({ ...f })))
  const setRow = (i, part) => (e) => setRows(rows.map((r, j) => (j === i ? { ...r, [part]: e.target.value } : r)))
  const [removed, setRemoved] = useState([])
  async function save() {
    const kept = rows.map((r) => ({ ...r, label: r.label.trim(), unit: r.unit.trim() }))
    if (kept.some((r) => !r.label)) return alert('Every field needs a name.')
    if (removed.length) {
      const all = await db.weights.toArray()
      const using = all.filter((e) => removed.some((k) => e.values?.[k]))
      if (using.length && !confirm(`${using.length} entr${using.length === 1 ? 'y has' : 'ies have'} values in the removed fields. Delete those values?`)) return
      await db.transaction('rw', db.weights, async () => {
        for (const e of using) {
          const values = Object.fromEntries(Object.entries(e.values).filter(([k]) => !removed.includes(k)))
          if (Object.keys(values).length) await db.weights.update(e.id, { values })
          else await db.weights.delete(e.id)
        }
      })
    }
    await saveBodyFields(kept)
    onClose()
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Fields</h2>
        <p className="muted small">Weight, body fat, muscle mass and waist are always there; lean mass follows from weight and body fat. Add any other measurement here, for every user.</p>
        <div className="nutrients">
          {rows.length > 0 && <div className="n-row with-x body-field n-head"><span /><span>name</span><span>unit</span><span /></div>}
          {rows.map((r, i) => (
            <div className="n-row with-x body-field" key={r.key}>
              <span />
              <input value={r.label} placeholder="e.g. Neck" aria-label="Name" autoFocus={!r.label} onChange={setRow(i, 'label')} />
              <input value={r.unit} placeholder="cm" aria-label="Unit" onChange={setRow(i, 'unit')} />
              <button className="icon small" aria-label={`Remove ${r.label}`} onClick={() => { setRows(rows.filter((_, j) => j !== i)); setRemoved([...removed, r.key]) }}><TrashIcon /></button>
            </div>
          ))}
          <button className="secondary" onClick={() => setRows([...rows, { key: newFieldKey(), label: '', unit: '' }])}>+ add field</button>
        </div>
        <div className="row actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
