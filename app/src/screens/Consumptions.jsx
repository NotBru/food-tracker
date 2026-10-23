import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DEFAULT_EXPIRY_DAYS, db, expiresAt, getConfig, getCurrentUser, itemLabel, parseExpiryDays } from '../db'
import { componentsTotal, concoctionsLeft, consumptionNutrients, keepUnit, lastEntryError, loadContext, nutrientsFor, resolve, unitsFor, usedUp } from '../calc'
import { addDays, dayBounds, prettyDay, toLocalInput, today } from '../time'
import { NUTRIENTS, amountText, deltaText, emptyNutrients, fmt, measure, normalizeNumber, pmText } from '../nutrients'
import { DEFAULT_ENTRY_ERROR } from '../errors'
import { AttributesEditor, Chevron, DateTimeInput, MadeTag, DeltaInput, EntryErrorButton, Field, ItemPicker, MacroLine, Screen, TrashIcon, UnitCombo, go, pressable, replace, useToday } from '../components'

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
    // Default time: now if viewing today, otherwise noon of the viewed day.
    const now = new Date()
    const dt = day === today(data.config.dayStart) ? now : new Date(`${day}T12:00`)
    setEditing({ datetime: dt.toISOString(), userId: data.user.id, itemId: null, amount: '', unit: '' })
  }

  async function remove(consumption, item) {
    if (confirm(`Delete ${item ? `“${itemLabel(item)}”` : 'this entry'} at ${toLocalInput(new Date(consumption.datetime)).slice(11)}?`)) {
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

// --- New concoction from the consumption sheet --------------------------------------------------------------
// Ticking "New concoction" on a new consumption swaps the food picker for a name and components. Saving adds the
// concoction (made at the consumption's time, its amount the sum of the components, like the food editor's Auto)
// and the consumption of it. A blank amount eaten means all of it, exactly. An existing concoction is edited under Foods.

const DRAFT_ID = -1
const round = (x, digits) => String(Number(x.toPrecision(digits)))
const emptyComponent = () => ({ itemId: null, amount: '', amountDelta: '', unit: '' })

/** Sum of `components` (stored form) as the concoction's amount: tries each unit in turn, rounded like Auto. */
function sumAs(ctx, components, units) {
  const totals = [...new Set(units)].map((u) => [u, componentsTotal(ctx, components, u)])
  const [unit, total] = totals.find(([, t]) => !t.problem) ?? totals[0]
  if (total.problem) return { problem: total.problem }
  const amount = round(total.value, 6)
  return { amount: Number(amount), amountText: amount, amountDelta: Number(round(total.delta, 3)), amountDeltaAuto: false, unit }
}

/** The concoction as it would be stored, or {problem} while it can't be added up yet. */
function concoctionDraft(ctx, form) {
  const components = form.components.filter((c) => c.itemId != null)
    .map((c) => {
      const m = measure(c.amount, c.amountDelta, c.unit)
      return {
        itemId: c.itemId, amount: m.value, amountText: m.text, amountDelta: m.delta, amountDeltaAuto: m.auto, unit: c.unit.trim(),
        entryError: Number.isFinite(c.entryError) ? c.entryError : undefined,
      }
    })
  if (!components.length) return { problem: 'add a component' }
  // In g if everything converts to it, else ml, else the first component's unit (e.g. eggs counted in u).
  const sum = sumAs(ctx, components, ['g', 'ml', components[0].unit || 'portion'])
  if (sum.problem) return { problem: sum.problem }
  return {
    units: [], nutrients: emptyNutrients(), source: null,
    name: form.name.trim(), brand: form.brand.trim(), attributes: form.attributes, ...sum, components,
    expiresAfterDays: parseExpiryDays(form.expiresAfterDays),
    madeAt: new Date(form.datetime).toISOString(),
    sum, // shown under the components; not stored
  }
}

/** The add/edit sheet. Also opened from a consumption's info screen, which leaves it on `onDeleted`. */
export function ConsumptionEditor({ ctx: savedCtx, dayStart, consumption, onClose, onDeleted = onClose }) {
  // Concoctions made before yesterday (logical days) are likely eaten up: listed after every other food.
  const oldBefore = dayBounds(addDays(today(dayStart), -1), dayStart)[0].toISOString()
  const addComponentRef = useRef(null)
  const [form, setForm] = useState(() => {
    return {
      ...consumption,
      datetime: toLocalInput(new Date(consumption.datetime)),
      amount: amountText(consumption.amount, consumption.amountText),
      amountDelta: deltaText(consumption.amountDelta, consumption.amountDeltaAuto),
      // In %; blank = the default.
      entryError: String(+((Number.isFinite(consumption.entryError) ? consumption.entryError : DEFAULT_ENTRY_ERROR) * 100).toPrecision(6)),
      concoction: false, name: '', brand: '', attributes: [], expiresAfterDays: '', components: [emptyComponent()],
    }
  })
  const picked = resolve(savedCtx, form.itemId)
  // Concoctions eaten up, or expired at the consumption's time, aren't offered. What this consumption took is counted
  // back in, so editing it still finds its food.
  const logs = useLiveQuery(() => db.logs.toArray(), [])
  const left = concoctionsLeft(savedCtx, logs ?? [], consumption.id)
  const at = new Date(form.datetime)
  const atIso = Number.isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString()
  const show = (it) => !it.madeAt || (expiresAt(it) > atIso && !usedUp(left.get(it.id)))
  // "Max": the rest of the picked concoction, in its own unit, with no error of its own (like "all of it").
  const rest = !form.concoction && left.get(form.itemId)
  const maxText = rest && rest.value > 0 ? round(rest.value, 6) : null
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const setC = (i, patch) => setForm((f) => ({ ...f, components: f.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  // The concoction is computed like a saved food: the draft is swapped into the context, under a placeholder id
  // while new.
  const draft = form.concoction ? concoctionDraft(savedCtx, form) : null
  const ctx = draft && !draft.problem ? { ...savedCtx, items: new Map(savedCtx.items).set(DRAFT_ID, { ...draft, id: DRAFT_ID }) } : savedCtx
  const itemId = form.concoction ? (draft.problem ? null : DRAFT_ID) : form.itemId
  // Error of the amount; blank = from the digits typed, like nutrient values ("250" -> ±1, "1.5" -> ±0.1).
  // Of a concoction being made, a blank amount is all of it: its own amount, with no error of its own.
  const all = form.concoction && form.amount.trim() === ''
  const m = all && itemId != null
    ? { value: draft.amount, text: draft.amountText, delta: 0, auto: false }
    : measure(form.amount, form.amountDelta, form.unit)
  // Its unit defaults to the concoction's own.
  const unit = form.concoction && itemId != null && (all || !form.unit.trim()) ? draft.unit : form.unit
  const amount = m.value
  // Entry error: a food of its own only (a recipe's components take the default). Blank or not a number: the default.
  const ownFood = !form.concoction && !picked?.components?.length
  const typedError = Number(normalizeNumber(form.entryError))
  const logError = ownFood && form.entryError.trim() && typedError >= 0 ? typedError / 100 : undefined
  const preview = itemId != null && amount > 0 && unit
    ? consumptionNutrients(ctx, { itemId, amount, unit, amountDelta: m.delta, entryError: logError }) : null

  // A food picked brings the entry error it was last logged with (calc.js lastEntryError).
  const pctText = (x) => String(+(x * 100).toPrecision(6))
  function pickItem(itemId) {
    setForm((f) => ({ ...f, itemId, unit: keepUnit(ctx, itemId, f.unit), entryError: pctText(lastEntryError(savedCtx, logs, itemId)) }))
  }

  function toggleConcoction(on) {
    // The amount eaten starts as "all of it"; a unit typed for the picked food may not fit the concoction.
    setForm((f) => ({ ...f, concoction: on, amount: '', amountDelta: '', unit: on ? '' : keepUnit(savedCtx, f.itemId, f.unit) ?? '' }))
  }

  async function save() {
    if (form.concoction) return saveConcoction()
    if (form.itemId == null || !(amount > 0) || !form.unit.trim()) return alert('Item, amount and unit are required.')
    const unit = form.unit.trim()
    if (!unitsFor(ctx, form.itemId).includes(unit.toLowerCase())
      && !confirm(`“${unit}” doesn't convert for this food, so its nutrients can't be computed (add it under the food's Units). Save anyway?`)) return
    const rec = {
      datetime: new Date(form.datetime).toISOString(), userId: consumption.userId, itemId: form.itemId,
      amount, amountText: m.text, amountDelta: m.delta, amountDeltaAuto: m.auto, unit: form.unit.trim(),
      entryError: logError,
    }
    if (consumption.id) await db.logs.update(consumption.id, rec)
    else await db.logs.add(rec)
    onClose() // stays on the same day's screen even if the date changed
  }

  async function saveConcoction() {
    if (!form.name.trim()) return alert('The concoction needs a name.')
    if (draft.problem) return alert(`Can't add up the components: ${draft.problem}.`)
    if (form.components.some((c) => c.itemId != null && !(measure(c.amount, c.amountDelta, c.unit).value >= 0))) {
      return alert('Every component needs an amount.')
    }
    if (!(amount > 0) || !unit.trim()) return alert('Amount eaten must be above 0 (leave it blank for all of it).')
    if (!unitsFor(ctx, DRAFT_ID).includes(unit.trim().toLowerCase())) return alert(`“${unit.trim()}” doesn't convert to ${draft.unit}.`)
    const { sum, id, ...rec } = draft
    const log = { datetime: new Date(form.datetime).toISOString(), userId: consumption.userId,
      amount, amountText: m.text, amountDelta: m.delta, amountDeltaAuto: m.auto, unit: unit.trim() }
    await db.transaction('rw', db.items, db.logs, async () => {
      await db.logs.add({ ...log, itemId: await db.items.add(rec) })
    })
    onClose()
  }

  async function remove() {
    if (confirm('Delete this entry?')) {
      await db.logs.delete(consumption.id)
      onDeleted()
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{consumption.id ? 'Edit consumption' : 'New consumption'}</h2>
        <Field label="Date and time">
          <DateTimeInput value={form.datetime} onChange={set('datetime')} />
        </Field>
        {!consumption.id && (
          <label className="check">
            <input type="checkbox" checked={form.concoction} onChange={(e) => toggleConcoction(e.target.checked)} />
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
                  <ItemPicker ctx={savedCtx} value={c.itemId} oldBefore={oldBefore} show={show} enterNext onChange={(id) => setC(i, { itemId: id, unit: keepUnit(savedCtx, id, c.unit) ?? '', entryError: lastEntryError(savedCtx, logs, id, true) })} />
                  {/* Enter in any of its boxes (a unit picked, ε set) goes on to "+ add component", as in the food editor. */}
                  <div className="row" onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); addComponentRef.current?.focus() } }}>
                    <input inputMode="decimal" placeholder="amount" value={c.amount} onChange={(e) => setC(i, { amount: e.target.value })} />
                    <DeltaInput value={c.amountDelta} amount={c.amount} unit={c.unit} onChange={(v) => setC(i, { amountDelta: v })} />
                    <UnitCombo units={c.itemId != null ? unitsFor(savedCtx, c.itemId) : null} value={c.unit} onChange={(u) => setC(i, { unit: u })} />
                    <EntryErrorButton value={c.entryError ?? DEFAULT_ENTRY_ERROR} onChange={(x) => setC(i, { entryError: x })} />
                    <button className="icon" onClick={() => setForm((f) => ({ ...f, components: f.components.filter((_, j) => j !== i) }))} aria-label="Remove">×</button>
                  </div>
                  {/* What this component brings in, live, as in the food editor. */}
                  {(() => {
                    const cm = measure(c.amount, c.amountDelta, c.unit)
                    if (c.itemId == null || !(cm.value >= 0)) return null
                    const sub = nutrientsFor(savedCtx, c.itemId, cm.value, c.unit.trim(), cm.delta, undefined, c.entryError)
                    return <MacroLine nutrients={sub.nutrients} ok={sub.ok} deltas />
                  })()}
                </li>
              ))}
              <li className="add" ref={addComponentRef} {...pressable(() => setForm((f) => ({ ...f, components: [...f.components, emptyComponent()] })), { focusOnClick: true, scrollUp: true })}>+ add component</li>
            </ul>
            <p className="small muted">
              {draft.problem ? `Total: ${draft.problem}`
                : `Total: ${draft.sum.problem ?? `${draft.sum.amountText} ± ${draft.sum.amountDelta} ${draft.sum.unit}`}`}
            </p>
          </>
        ) : (
          <Field label="Item">
            <ItemPicker ctx={ctx} value={form.itemId} oldBefore={oldBefore} show={show} onChange={pickItem} enterNext />
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
            <UnitCombo units={itemId != null ? unitsFor(ctx, itemId) : null} value={form.unit} onChange={set('unit')} enterNext />
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
          <button className="secondary" onClick={() => setForm((f) => ({ ...f, amount: maxText, amountDelta: '0', unit: rest.unit }))}>
            Max: {maxText} {rest.unit} left
          </button>
        )}
        {preview && <p><MacroLine nutrients={preview.nutrients} ok={preview.ok} deltas /></p>}
        {preview?.ok && <NutrientDetails nutrients={preview.nutrients} />}
        <div className="row actions">
          {consumption.id && <button className="danger" onClick={remove}>Delete</button>}
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={save}>{form.concoction ? 'Add' : 'Save'}</button>
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
  const rows = NUTRIENTS.filter(({ key }) => key !== 'energy' && nutrients[key] && !(nutrients[key].missing && nutrients[key].value === 0))
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
