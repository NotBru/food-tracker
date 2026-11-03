import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DEFAULT_EXPIRY_DAYS, db, getConfig, getCurrentUser, itemLabel } from '../db'
import { consumptionNutrients, loadContext, resolve } from '../calc'
import { addDays, dayBounds, prettyDay, toLocalInput, today } from '../time'
import { amountText, fmt, pmText } from '../nutrients'
import { DEFAULT_ENTRY_ERROR } from '../errors'
import { componentUnits, deleteQuestion, detailRows, editorState, emptyComponent, initialForm, newConsumption as newConsumptionAt, pickComponent, pickItem, save as saveForm, saveProblem, setComponent, takeMax, toggleConcoction, unitsOf } from '../consumptionForm'
import { AttributesEditor, Chevron, DateTimeInput, MadeTag, DeltaInput, EntryErrorButton, Field, enterSaves, ItemPicker, MacroLine, Screen, TrashIcon, UnitCombo, go, pressable, replace, useToday } from '../components'

export default function Consumptions({ day: dayParam, add }) {
  const dateRef = useRef(null)
  const [editing, setEditing] = useState(null) // consumption record, or a blank one for new
  const todayDay = useToday()

  const data = useLiveQuery(async () => {
    const config = await getConfig()
    const day = dayParam || todayDay || today(config.dayStart)
    const [start, end] = dayBounds(day, config.dayStart)
    const user = await getCurrentUser()
    const logs = await db.logs.where('[userId+datetime]').between([user.id, start.toISOString()], [user.id, end.toISOString()], true, false)
      .reverse().toArray() // newest first
    const ctx = await loadContext()
    return { day, ctx, config, user, rows: logs.map((c) => ({ consumption: c, item: resolve(ctx, c.itemId), n: consumptionNutrients(ctx, c) })) }
  }, [dayParam, todayDay])

  // Opened with ?new (the homescreen's +): straight into a new consumption, once; the flag leaves the URL so
  // closing the editor or reloading doesn't bring it back.
  const added = useRef(false)
  useEffect(() => {
    if (!add || !data || added.current) return
    added.current = true
    newConsumption()
    replace(`/consumptions${dayParam ? `?day=${dayParam}` : ''}`)
  }, [add, data])

  if (!data) return null
  const { day, ctx, rows } = data
  // Replace, not push: browsing days shouldn't make back walk through them.
  const setDay = (d) => replace(`/consumptions?day=${d}`)

  function newConsumption() {
    setEditing(newConsumptionAt(day, data.config.dayStart, data.user.id))
  }

  async function remove(consumption, item) {
    if (confirm(deleteQuestion(consumption, item))) {
      await db.logs.delete(consumption.id)
    }
  }

  return (
    <Screen title="Consumptions" subtitle={data.user.name} right={<button className="icon" onClick={() => (dateRef.current.showPicker ? dateRef.current.showPicker() : dateRef.current.focus())} aria-label="Pick day">📅</button>}>
      <div className="day-nav">
        <button className="icon" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day"><Chevron /></button>
        <span>{prettyDay(day)}</span>
        <button className="icon" onClick={() => setDay(addDays(day, 1))} aria-label="Next day"><Chevron dir="right" /></button>
        <input ref={dateRef} type="date" className="hidden-date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
      </div>

      <ul className="list">
        <li className="add" onClick={newConsumption}>+ add consumption</li>
        {rows.map(({ consumption, item, n }) => (
          <li key={consumption.id} className="with-trash" onClick={() => go(`/consumptions/${consumption.id}`)}>
            <div className="list-body">
              <div className="list-main">
                <span>{item ? <>{itemLabel(item)} <MadeTag item={item} /></> : '(deleted item)'}</span>
                <span className="muted">{toLocalInput(new Date(consumption.datetime)).slice(11)} · {amountText(consumption.amount, consumption.amountText)}{consumption.amountDeltaAuto === false && ` ±${consumption.amountDelta}`} {consumption.unit}</span>
              </div>
              <MacroLine nutrients={n.nutrients} ok={n.ok} deltas />
            </div>
            <button className="icon trash" aria-label="Delete"
              onClick={(e) => { e.stopPropagation(); remove(consumption, item) }}><TrashIcon /></button>
          </li>
        ))}
      </ul>

      {editing && <ConsumptionEditor ctx={ctx} dayStart={data.config.dayStart} consumption={editing} onClose={() => setEditing(null)} />}
    </Screen>
  )
}

/** The add/edit sheet. Also opened from a consumption's info screen, which leaves it on `onDeleted`. */
export function ConsumptionEditor({ ctx: savedCtx, dayStart, consumption, onClose, onDeleted = onClose }) {
  const addComponentRef = useRef(null)
  const [form, setForm] = useState(() => initialForm(consumption))
  const logs = useLiveQuery(() => db.logs.toArray(), [])
  const st = editorState(savedCtx, logs ?? [], consumption, form, dayStart)
  const { oldBefore, show, rest, maxText, ctx, itemId, unit, ownFood, preview } = st
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const setC = (i, patch) => setForm((f) => setComponent(f, i, patch))

  async function save(confirmed = false) {
    const problem = saveProblem(st, confirmed)
    if (problem?.alert) return alert(problem.alert)
    if (problem?.confirm) return confirm(problem.confirm) && save(true)
    await saveForm(st)
    onClose() // stays on the same day's screen even if the date changed
  }

  async function remove() {
    if (confirm('Delete this entry?')) {
      await db.logs.delete(consumption.id)
      onDeleted()
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} onKeyDown={enterSaves(() => save())}>
        <h2>{consumption.id ? 'Edit consumption' : 'New consumption'}</h2>
        <Field label="Date and time">
          <DateTimeInput value={form.datetime} onChange={set('datetime')} />
        </Field>
        {!consumption.id && (
          <label className="check">
            <input type="checkbox" checked={form.concoction} onChange={(e) => setForm(toggleConcoction(st, e.target.checked))} />
            <span>New concoction (made at this time)</span>
          </label>
        )}
        {form.concoction ? (
          <>
            <Field label="Name"><input value={form.name} onChange={(e) => set('name')(e.target.value)} /></Field>
            <Field label="Brand"><input value={form.brand} onChange={(e) => set('brand')(e.target.value)} /></Field>
            <Field label="Attributes"><AttributesEditor value={form.attributes} onChange={set('attributes')} /></Field>
            <h3>Components</h3>
            <ul className="list compact">
              {form.components.map((c, i) => (
                <li key={i} className="component">
                  <ItemPicker ctx={savedCtx} value={c.itemId} oldBefore={oldBefore} show={show} enterNext onChange={(id) => setForm(pickComponent(st, i, id))} />
                  {/* Enter in any of its boxes (a unit picked, ε set) goes on to "+ add component", as in the food editor. */}
                  <div className="row" onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); addComponentRef.current?.focus() } }}>
                    <input inputMode="decimal" placeholder="amount" value={c.amount} onChange={(e) => setC(i, { amount: e.target.value })} />
                    <DeltaInput value={c.amountDelta} amount={c.amount} unit={c.unit} onChange={(v) => setC(i, { amountDelta: v })} />
                    <UnitCombo units={componentUnits(st, c)} value={c.unit} onChange={(u) => setC(i, { unit: u })} />
                    <EntryErrorButton value={c.entryError ?? DEFAULT_ENTRY_ERROR} onChange={(x) => setC(i, { entryError: x })} />
                    <button className="icon" onClick={() => setForm((f) => ({ ...f, components: f.components.filter((_, j) => j !== i) }))} aria-label="Remove">×</button>
                  </div>
                  {/* What this component brings in, live, as in the food editor. */}
                  {st.componentNutrients[i] && <MacroLine nutrients={st.componentNutrients[i].nutrients} ok={st.componentNutrients[i].ok} deltas />}
                </li>
              ))}
              <li className="add" ref={addComponentRef} {...pressable(() => setForm((f) => ({ ...f, components: [...f.components, emptyComponent()] })), { focusOnClick: true, scrollUp: true })}>+ add component</li>
            </ul>
            <p className="small muted">{st.total}</p>
          </>
        ) : (
          <Field label="Item">
            <ItemPicker ctx={ctx} value={form.itemId} oldBefore={oldBefore} show={show} onChange={(id) => setForm(pickItem(st, id))} enterNext />
          </Field>
        )}
        <div className="row amount-row">
          <Field label={form.concoction ? 'Amount eaten' : 'Amount'}>
            <input inputMode="decimal" value={form.amount} placeholder={form.concoction ? 'all' : undefined} onChange={(e) => set('amount')(e.target.value)} />
          </Field>
          <Field label="± Δ">
            <DeltaInput value={form.amountDelta} amount={form.amount} unit={unit} onChange={set('amountDelta')} />
          </Field>
          <Field label="Unit">
            <UnitCombo units={unitsOf(st)} value={form.unit} onChange={set('unit')} enterNext />
          </Field>
        </div>
        {ownFood && (
          <Field label="Entry error, % (how far the food may be from what's eaten; 0 if it's the product on the label)">
            <input inputMode="decimal" value={form.entryError} placeholder={fmt(DEFAULT_ENTRY_ERROR * 100)} onChange={(e) => set('entryError')(e.target.value)} />
          </Field>
        )}
        {form.concoction && (
          <Field label="Expires after (days)">
            <input inputMode="decimal" value={form.expiresAfterDays} placeholder={String(DEFAULT_EXPIRY_DAYS)} onChange={(e) => set('expiresAfterDays')(e.target.value)} />
          </Field>
        )}
        {maxText && (
          <button className="secondary" onClick={() => setForm(takeMax(st))}>
            Max: {maxText} {rest.unit} left
          </button>
        )}
        {preview && <p><MacroLine nutrients={preview.nutrients} ok={preview.ok} deltas /></p>}
        {preview?.ok && <NutrientDetails nutrients={preview.nutrients} />}
        <div className="row actions">
          {consumption.id && <button className="danger" onClick={remove}>Delete</button>}
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={() => save()}>{form.concoction ? 'Add' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

/**
 * Drop-down with every nutrient known for this consumption (e.g. a coffee's caffeine, which the macro line hides).
 * Nutrients no food in it has a value for are left out; "+?" marks one only some of its components know.
 */
function NutrientDetails({ nutrients }) {
  const [open, setOpen] = useState(false)
  const rows = detailRows(nutrients)
  return (
    <div className="details">
      <button className="link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? '▾' : '▸'} Details
      </button>
      {open && (
        <ul className="details-list">
          {rows.map(({ key, label, unit }) => {
            const n = nutrients[key]
            return (
              <li key={key}>
                <span>{label}</span>
                <span>
                  {fmt(n.value, 2)}<small className="pm"> {pmText(n, 2)}</small> {unit}
                  {n.missing && <small className="muted" title="Some components don't list it"> +?</small>}
                </span>
              </li>
            )
          })}
          {!rows.length && <li className="muted">No nutrients known</li>}
        </ul>
      )}
    </div>
  )
}
