import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { fmt, pmText } from '../nutrients'
import { entryForm, entryText, loadBody, maintenanceText, saveEntry } from '../forms'
import { formatDateTime, toLocalInput } from '../time'
import { DateTimeInput, DeltaInput, Screen, enterSaves, pressable, replace, useListNav, useToday } from '../components'
import { BUILTIN_FIELDS, lookalike, nameKey, nameMatches } from '../body'

// Body measurements (weight, body fat, muscle % and mass, waist, and any other named per entry), each with its ± Δ, newest
// first; the 7-day averages, and what weight says about maintenance calories (body.js).

export default function Body({ add }) {
  const day = useToday()
  const data = useLiveQuery(() => (day ? loadBody(day) : null), [day])
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
  const t = maintenanceText(maint)
  if (t.need) return <p className="muted">{t.need}</p>
  return (
    <>
      <p>
        <span className="muted">Maintenance ≈ </span><b className="c-kcal">{t.value}</b> kcal/day
        <span className="muted"> ({t.range})</span>
      </p>
      <p className="muted small">{t.detail}</p>
    </>
  )
}

/**
 * An entry: a value and ± Δ per built-in field (blank Δ: from the digits), any other measurement added like an
 * attribute (name, value, ± Δ, unit), any left blank but not all, and a time. Names are looked up among those used
 * before as they're typed; saving a name that looks like a typo of a known one asks first.
 */
function EntryEditor({ entry, known, last, onClose }) {
  const [texts, setTexts] = useState(() => entryForm(entry).texts)
  const set = (key, part) => (v) => setTexts({ ...texts, [key]: { ...texts[key], [part]: v } })
  const [extra, setExtra] = useState(() => entryForm(entry).extra)
  const setX = (i, part) => (v) => setExtra(extra.map((x, j) => (j === i ? { ...x, [part]: v } : x)))
  const [datetime, setDatetime] = useState(toLocalInput(new Date(entry.datetime)))
  const refs = useRef([])
  async function save(answers = {}) {
    const problem = await saveEntry(entry, { texts, extra, datetime }, known, answers)
    if (problem?.alert) return alert(problem.alert)
    if (problem?.ask) return save({ ...answers, [problem.ask.label]: confirm(problem.ask.text) })
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
      <div className="sheet" onClick={(e) => e.stopPropagation()} onKeyDown={enterSaves(() => save())}>
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
          <button onClick={() => save()}>Save</button>
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
