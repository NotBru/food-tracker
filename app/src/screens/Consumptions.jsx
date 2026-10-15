import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getConfig, itemLabel } from '../db'
import { consumptionNutrients, keepUnit, loadContext, resolve, unitsFor } from '../calc'
import { addDays, dayBounds, prettyDay, toLocalInput, today } from '../time'
import { amountText, deltaText, measure } from '../nutrients'
import { DeltaInput, Field, ItemPicker, MacroLine, Screen, UnitCombo, replace } from '../components'

export default function Consumptions({ day: dayParam }) {
  const dateRef = useRef(null)
  const [editing, setEditing] = useState(null) // consumption record, or a blank one for new

  const data = useLiveQuery(async () => {
    const config = await getConfig()
    const day = dayParam || today(config.dayStart)
    const [start, end] = dayBounds(day, config.dayStart)
    const logs = await db.logs.where('datetime').between(start.toISOString(), end.toISOString(), true, false).reverse().sortBy('datetime') // newest first
    const ctx = await loadContext()
    return { day, ctx, config, rows: logs.map((c) => ({ consumption: c, item: resolve(ctx, c.itemId), n: consumptionNutrients(ctx, c) })) }
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
              <span className="muted">{new Date(consumption.datetime).toLocaleTimeString(undefined, { timeStyle: 'short' })} · {amountText(consumption.amount, consumption.amountText)}{consumption.amountDeltaAuto === false && ` ±${consumption.amountDelta}`} {consumption.unit}</span>
            </div>
            <MacroLine nutrients={n.nutrients} ok={n.ok} deltas />
          </li>
        ))}
        <li className="add" onClick={newConsumption}>+ add consumption</li>
      </ul>

      {editing && <ConsumptionEditor ctx={ctx} consumption={editing} onClose={() => setEditing(null)} />}
    </Screen>
  )
}

function ConsumptionEditor({ ctx, consumption, onClose }) {
  const [form, setForm] = useState({
    ...consumption,
    datetime: toLocalInput(new Date(consumption.datetime)),
    amount: amountText(consumption.amount, consumption.amountText),
    amountDelta: deltaText(consumption.amountDelta, consumption.amountDeltaAuto),
  })
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  // Error of the amount; blank = from the digits typed, like nutrient values ("250" -> ±1, "1.5" -> ±0.1).
  const m = measure(form.amount, form.amountDelta)
  const amount = m.value
  const preview = form.itemId != null && amount > 0 && form.unit
    ? consumptionNutrients(ctx, { itemId: form.itemId, amount, unit: form.unit, amountDelta: m.delta }) : null

  function pickItem(itemId) {
    setForm((f) => ({ ...f, itemId, unit: keepUnit(ctx, itemId, f.unit) }))
  }

  async function save() {
    if (form.itemId == null || !(amount > 0) || !form.unit.trim()) return alert('Item, amount and unit are required.')
    const unit = form.unit.trim()
    if (!unitsFor(ctx, form.itemId).includes(unit.toLowerCase())
      && !confirm(`“${unit}” doesn't convert for this food, so its nutrients can't be computed (add it under the food's Units). Save anyway?`)) return
    const rec = {
      datetime: new Date(form.datetime).toISOString(), itemId: form.itemId,
      amount, amountText: m.text, amountDelta: m.delta, amountDeltaAuto: m.auto, unit: form.unit.trim(),
    }
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
        <div className="row amount-row">
          <Field label="Amount">
            <input inputMode="decimal" value={form.amount} onChange={(e) => set('amount')(e.target.value)} />
          </Field>
          <Field label="± Δ">
            <DeltaInput value={form.amountDelta} amount={form.amount} onChange={set('amountDelta')} />
          </Field>
          <Field label="Unit">
            <UnitCombo units={form.itemId != null ? unitsFor(ctx, form.itemId) : null} value={form.unit} onChange={set('unit')} />
          </Field>
        </div>
        {preview && <p><MacroLine nutrients={preview.nutrients} ok={preview.ok} deltas /></p>}
        <div className="row actions">
          {consumption.id && <button className="danger" onClick={remove}>Delete</button>}
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
