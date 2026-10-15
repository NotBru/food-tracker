import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getConfig, itemLabel } from '../db'
import { keepUnit, loadContext, nutrientsFor, resolve, unitsFor } from '../calc'
import { addDays, dayBounds, prettyDay, toLocalInput, today } from '../time'
import { Field, ItemPicker, MacroLine, Screen, UnitSelect, replace } from '../components'

export default function Consumptions({ day: dayParam }) {
  const dateRef = useRef(null)
  const [editing, setEditing] = useState(null) // consumption record, or a blank one for new

  const data = useLiveQuery(async () => {
    const config = await getConfig()
    const day = dayParam || today(config.dayStart)
    const [start, end] = dayBounds(day, config.dayStart)
    const logs = await db.logs.where('datetime').between(start.toISOString(), end.toISOString(), true, false).sortBy('datetime')
    const ctx = await loadContext()
    return { day, ctx, config, rows: logs.map((c) => ({ consumption: c, item: resolve(ctx, c.itemId), n: nutrientsFor(ctx, c.itemId, c.amount, c.unit) })) }
  }, [dayParam])

  if (!data) return null
  const { day, ctx, rows } = data
  // Replace, not push: browsing days shouldn't make back walk through them.
  const setDay = (d) => replace(`/consumptions?day=${d}`)

  function newConsumption() {
    // Default time: now if viewing today, otherwise noon of the viewed day.
    const now = new Date()
    const dt = day === today(data.config.dayStart) ? now : new Date(`${day}T12:00`)
    setEditing({ datetime: dt.toISOString(), itemId: null, amount: '', unit: '' })
  }

  return (
    <Screen title="Consumptions" right={<button className="icon" onClick={() => (dateRef.current.showPicker ? dateRef.current.showPicker() : dateRef.current.focus())} aria-label="Pick day">📅</button>}>
      <div className="day-nav">
        <button className="icon" onClick={() => setDay(addDays(day, -1))}>‹</button>
        <span>{prettyDay(day)}</span>
        <button className="icon" onClick={() => setDay(addDays(day, 1))}>›</button>
        <input ref={dateRef} type="date" className="hidden-date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
      </div>

      <ul className="list">
        {rows.map(({ consumption, item, n }) => (
          <li key={consumption.id} onClick={() => setEditing(consumption)}>
            <div className="list-main">
              <span>{item ? itemLabel(item) : '(deleted item)'}</span>
              <span className="muted">{new Date(consumption.datetime).toLocaleTimeString(undefined, { timeStyle: 'short' })} · {consumption.amount} {consumption.unit}</span>
            </div>
            <MacroLine nutrients={n.nutrients} ok={n.ok} />
          </li>
        ))}
        <li className="add" onClick={newConsumption}>+ add consumption</li>
      </ul>

      {editing && <ConsumptionEditor ctx={ctx} consumption={editing} onClose={() => setEditing(null)} />}
    </Screen>
  )
}

function ConsumptionEditor({ ctx, consumption, onClose }) {
  const [form, setForm] = useState({ ...consumption, datetime: toLocalInput(new Date(consumption.datetime)) })
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const amount = Number(form.amount)
  const preview = form.itemId != null && amount > 0 && form.unit ? nutrientsFor(ctx, form.itemId, amount, form.unit) : null

  function pickItem(itemId) {
    setForm((f) => ({ ...f, itemId, unit: keepUnit(ctx, itemId, f.unit) }))
  }

  async function save() {
    if (form.itemId == null || !(amount > 0) || !form.unit) return alert('Item, amount and unit are required.')
    const rec = { datetime: new Date(form.datetime).toISOString(), itemId: form.itemId, amount, unit: form.unit.trim() }
    if (consumption.id) await db.logs.update(consumption.id, rec)
    else await db.logs.add(rec)
    onClose() // stays on the same day's screen even if the date changed
  }

  async function remove() {
    if (confirm('Delete this entry?')) {
      await db.logs.delete(consumption.id)
      onClose()
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{consumption.id ? 'Edit consumption' : 'New consumption'}</h2>
        <Field label="Date and time">
          <input type="datetime-local" value={form.datetime} onChange={(e) => set('datetime')(e.target.value)} />
        </Field>
        <Field label="Item">
          <ItemPicker ctx={ctx} value={form.itemId} onChange={pickItem} />
        </Field>
        <div className="row">
          <Field label="Amount">
            <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => set('amount')(e.target.value)} />
          </Field>
          <Field label="Unit">
            <UnitSelect units={form.itemId != null ? unitsFor(ctx, form.itemId) : null} value={form.unit} onChange={set('unit')} />
          </Field>
        </div>
        {preview && <p><MacroLine nutrients={preview.nutrients} ok={preview.ok} /></p>}
        <div className="row actions">
          {consumption.id && <button className="danger" onClick={remove}>Delete</button>}
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
