import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DEFAULT_EXPIRY_DAYS, conflictingFoods, db, getConfig, itemLabel, kindOf } from '../db'
import { foodListMatches } from '../search'
import { baseAmount, loadContext, nutrientsFor } from '../calc'
import { amountText } from '../nutrients'
import { DEFAULT_ENTRY_ERROR } from '../errors'
import { CATEGORY_OPTIONS, CORE, DELETE_QUESTION, autoAmount as fillAuto, componentUnits, editorState, initialForm, newComponent, newUnit, nutrientRowsShown, pickComponent, round, sameIdAs, save as saveFood, saveProblem, withCreated } from '../foodForm'
import { clearPendingDraft, peekPendingDraft, sourceLabel } from '../external'
import { AttributesEditor, DateTimeInput, DeltaInput, EntryErrorButton, Field, ItemPicker, MadeTag, MacroLine, NutrientAdder, Screen, Select, pressable, UnitCombo, UnitInput, enterSaves, enterTo, go, replace } from '../components'
import FoodInfo from './FoodInfo'

// A food is anything you can eat: an ingredient, a recipe (has components) or a concoction (has a made-at time).
// One list, one editor; what kind a food is follows from its fields. CIQUAL's and USDA's foods are listed too (while searching,
// after the user's own), read-only: editing one saves a copy.

export function FoodList() {
  const [query, setQuery] = useState('')
  const ctx = useLiveQuery(loadContext)
  if (!ctx) return null
  const conflicts = conflictingFoods(ctx.list)
  const rows = foodListMatches(ctx, query)
  return (
    <Screen title="Foods">
      <input className="search" type="search" placeholder="Search foods…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="list">
        <li className="add" onClick={() => go('/foods/new')}>+ add new food</li>
        {rows.map(([r, label]) => {
          const [amt, unit] = baseAmount(r)
          const n = nutrientsFor(ctx, r.id, amt, unit)
          return (
            <li key={r.id} onClick={() => go(`/foods/${r.id}`)}>
              <div className="list-main">
                <span>
                  {label}{kindOf(r) === 'recipe' && <small className="muted"> · recipe</small>} <MadeTag item={r} />
                  {conflicts.has(r.id) && <small className="warn" title="Another food has the same ID with different values"> · ⚠ same ID</small>}
                </span>
                <span className="muted">per {r.amount > 0 ? amountText(amt, r.amountText) : amt}{r.amountDeltaAuto === false && r.amountDelta > 0 && ` ±${r.amountDelta}`} {unit}</span>
              </div>
              <MacroLine nutrients={n.nutrients} ok={n.ok} />
            </li>
          )
        })}
      </ul>
    </Screen>
  )
}

// --- New food from a component ("+" beside its search box) -----------------------
// The form being edited is stashed here, the new food opens on top (`/foods/new?in=<depth>`, so the hash differs
// from a parent that is itself a new food), and back on the parent's hash the form is restored, with the new food
// (if it was saved) set as that component, amount still to fill. Nests: each level pushes its own entry.
// In memory only, like the external draft: a reload drops it.
const parents = [] // [{ hash, name, form, extraShown, index, created }]

/** An existing food has two tabs, Edit and Info (`?tab=info`); a new one only the form. `nutrient` (from a breakdown)
 * ranks the Info tab's components by that nutrient, and is kept across tab switches. */
export function FoodEditor({ id, tab, nutrient, nested, name }) {
  const isNew = id === 'new'
  const data = useLiveQuery(async () => {
    const ctx = await loadContext()
    const rec = isNew ? null : /^(ciqual|fdc):/.test(id) ? ctx.items.get(id) ?? null : await db.items.get(id)
    return { id, ctx, rec, dayStart: (await getConfig()).dayStart }
  }, [id])
  // useLiveQuery keeps the previous result while a new id loads; don't build the form from another food's data.
  if (!data || data.id !== id) return null
  if (!isNew && !data.rec) return <Screen title="Edit food"><p className="muted">Food not found (deleted?).</p></Screen>
  const info = !isNew && tab === 'info'
  const parent = nested && parents[Number(nested) - 1]
  return (
    // A new component looks like any new food, so its title says what it is for.
    <Screen title={parent ? 'New component' : isNew ? 'New food' : data.rec.name || 'Food'} subtitle={parent && `for ${parent.name ? `“${parent.name}”` : 'the new food'}`}>
      {!isNew && (
        <div className="segmented food-tabs" role="tablist" aria-label="Food">
          {[['edit', 'Edit'], ['info', 'Info']].map(([v, label]) => (
            <button key={v} role="tab" aria-selected={(v === 'info') === info} className={(v === 'info') === info ? 'on' : ''}
              onClick={() => replace(`/foods/${id}${v === 'info' ? '?tab=info' : ''}${nutrient ? `${v === 'info' ? '&' : '?'}nutrient=${nutrient}` : ''}`)}>{label}</button>
          ))}
        </div>
      )}
      {/* The form stays mounted while Info is shown, so unsaved edits survive a look at the info. */}
      <div hidden={info}>
        {/* A new food may come prefilled from "Search external" (draft handed over by external.js). */}
        {/* A read-only (CIQUAL, USDA) food prefills a new one: saving makes the copy. */}
        <FoodForm key={`${id}:${nested ?? ''}`} ctx={data.ctx} dayStart={data.dayStart} initial={data.rec?.readOnly ? null : data.rec}
          prefill={isNew ? peekPendingDraft() : data.rec?.readOnly ? data.rec : null} copy={!!data.rec?.readOnly}
          nested={!!parent} name={name} />
      </div>
      {!isNew && <SameIdWarning ctx={data.ctx} item={data.rec} />}
      {info && <FoodInfo ctx={data.ctx} item={data.rec} nutrient={nutrient} />}
    </Screen>
  )
}

/** Flags other foods with this one's ID (name, brand, attributes, made-at) but different values. */
function SameIdWarning({ ctx, item }) {
  const others = sameIdAs(ctx, item)
  if (!others) return null
  return (
    <p className="small warn">
      ⚠ Same ID as {others.length > 1 ? `${others.length} other foods` : 'another food'} with different values:{' '}
      {others.map((id, i) => (
        <span key={id}>{i > 0 && ', '}<button className="link" onClick={() => go(`/foods/${id}`)}>#{id}</button></span>
      ))}
    </p>
  )
}

function FoodForm({ ctx, dayStart, initial, prefill, copy, nested, name }) {
  const src = initial ?? prefill
  // Back from a new component: this form's stashed state. Taken off the stack in an effect, since StrictMode runs
  // state initializers twice.
  const [restored] = useState(() => (parents.at(-1)?.hash === location.hash ? parents.at(-1) : null))
  useEffect(() => { if (restored && parents.at(-1) === restored) parents.pop() }, [restored])
  const [form, setForm] = useState(() => (restored ? withCreated(ctx, restored.form, restored.index, restored.created) : initialForm(src, initial, name)))
  useEffect(() => { if (prefill) clearPendingDraft() }, [prefill])
  // A component picked starts with the entry error its food last had in a concoction, else was last logged with
  // (calc.js lastEntryError).
  const logs = useLiveQuery(() => db.logs.toArray(), [])
  const st = editorState(ctx, logs ?? [], form, initial, dayStart)
  const { oldBefore, show, hasComponents, amt, unit, preview, totalUnit, total } = st
  // Extra (non-core) nutrients shown even while empty, because the user just added them.
  const [extraShown, setExtraShown] = useState(restored?.extraShown ?? [])
  // Back with a new component: the cursor goes to its amount, the one thing left to fill.
  const componentAmountRefs = useRef([])
  const addComponentRef = useRef(null)
  useEffect(() => {
    const el = restored?.created != null && componentAmountRefs.current[restored.index]
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }) }
  }, [restored])
  // "+" beside a component's search box: stash this form, open a new food (named from what's typed) on top.
  function createComponent(index, text) {
    parents.push({ hash: location.hash, name: form.name.trim(), form, extraShown, index, created: null })
    go(`/foods/new?in=${parents.length}${text ? `&name=${encodeURIComponent(text)}` : ''}`)
  }
  // Nutrient just added: its value field gets the cursor once the row exists.
  const [focusKey, setFocusKey] = useState(null)
  const valueRefs = useRef({})
  const adderRef = useRef(null) // Enter in a nutrient's value goes here
  // Optional nutrients only: clears the value (so it's stored as NaN again) and hides the row.
  const removeNutrient = (key) => {
    setForm((f) => ({ ...f, nutrients: { ...f.nutrients, [key]: { text: '' } } }))
    setExtraShown((s) => s.filter((k) => k !== key))
  }
  useEffect(() => {
    const el = focusKey && valueRefs.current[focusKey]
    if (!el) return
    el.focus()
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFocusKey(null)
  }, [focusKey])
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const setU = (i, patch) => setForm((f) => ({ ...f, units: f.units.map((u, j) => (j === i ? { ...u, ...patch } : u)) }))
  const setC = (i, patch) => setForm((f) => ({ ...f, components: f.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  const setN = (key, field, v) => setForm((f) => ({ ...f, nutrients: { ...f.nutrients, [key]: { ...f.nutrients[key], [field]: v } } }))

  function autoAmount() {
    setForm(fillAuto(st))
  }

  async function save() {
    const problem = saveProblem(form)
    if (problem) return alert(problem)
    const id = await saveFood(ctx, form, initial)
    // Made as a component: the parent (next back) picks it up.
    if (!initial && nested && parents.length) parents.at(-1).created = id
    history.back()
  }
  async function remove() {
    if (confirm(DELETE_QUESTION)) {
      await db.items.delete(initial.id)
      history.back()
    }
  }

  // Into a new component and back: the form slides in (from the right / left), so the switch is seen.
  return (
      <div className={`form ${nested && !restored ? 'slide-in' : restored ? 'slide-back' : ''}`} onKeyDown={enterSaves(save)}>
        {copy && <p className="muted small">A {prefill.source?.db === 'fdc' ? 'USDA' : 'CIQUAL'} food, read-only: saving makes it a food of your own.</p>}
        {!initial && !copy && (
          // Save also sits up here, smaller, so a prefilled draft can be saved without scrolling.
          <div className="row ext-row">
            <button className="secondary" onClick={() => go(`/foods/external${form.name.trim() ? `?q=${encodeURIComponent(form.name.trim())}` : ''}`)}>
              Search external databases…
            </button>
            <button className="save-top" onClick={save}>Save</button>
          </div>
        )}
        {(() => {
          const s = sourceLabel(form.source)
          return s && (
            <p className="muted small">
              From <a href={s.href} target="_blank" rel="noreferrer">{s.text}</a>
              {' '}<button className="link" onClick={() => set('source')(null)}>unlink</button>
            </p>
          )
        })()}
        <Field label="Name"><input value={form.name} onChange={(e) => set('name')(e.target.value)} /></Field>
        <Field label="Brand"><input value={form.brand} onChange={(e) => set('brand')(e.target.value)} /></Field>
        <Field label="Attributes"><AttributesEditor value={form.attributes} onChange={set('attributes')} /></Field>
        <h3>Units</h3>
        <ul className="list compact">
          {form.units.map((u, i) => (
            <li key={i} className="component">
              {/* Two lines: "1 ± Δ slice" / "= 30 ± Δ g". */}
              <div className="row conv">
                <span className="conv-eq" />
                <input inputMode="decimal" value={u.fromAmount} onChange={(e) => setU(i, { fromAmount: e.target.value })} />
                <DeltaInput value={u.fromDelta} amount={u.fromAmount} unit={u.fromUnit} onChange={(v) => setU(i, { fromDelta: v })} />
                <UnitInput value={u.fromUnit} placeholder="slice" onChange={(v) => setU(i, { fromUnit: v })} />
                <button className="icon" onClick={() => setForm((f) => ({ ...f, units: f.units.filter((_, j) => j !== i) }))} aria-label="Remove">×</button>
              </div>
              <div className="row conv">
                <span className="conv-eq">=</span>
                <input inputMode="decimal" value={u.toAmount} onChange={(e) => setU(i, { toAmount: e.target.value })} />
                <DeltaInput value={u.toDelta} amount={u.toAmount} unit={u.toUnit} onChange={(v) => setU(i, { toDelta: v })} />
                <UnitInput value={u.toUnit} onChange={(v) => setU(i, { toUnit: v })} />
                <span className="icon-gap" />
              </div>
            </li>
          ))}
          <li className="add" {...pressable(() => setForm((f) => ({ ...f, units: [...f.units, newUnit(f)] })))}>+ add unit</li>
        </ul>
        <p className="muted small">g/kg/mg/oz/lb and ml/l/cl/dl/tsp/tbsp/cup convert automatically.</p>

        <label className="check">
          <input type="checkbox" checked={form.isMade} onChange={(e) => set('isMade')(e.target.checked)} />
          <span>Made at a specific time (concoction)</span>
        </label>
        {form.isMade && (
          <>
            <Field label="Made at"><DateTimeInput value={form.madeAt} onChange={set('madeAt')} /></Field>
            <Field label="Expires after (days)">
              <input inputMode="decimal" value={form.expiresAfterDays} placeholder={String(DEFAULT_EXPIRY_DAYS)} onChange={(e) => set('expiresAfterDays')(e.target.value)} />
            </Field>
          </>
        )}

        <h3>Components</h3>
        <ul className="list compact">
          {form.components.map((c, i) => (
            <li key={i} className="component">
              <ItemPicker ctx={ctx} value={c.itemId} exclude={initial?.id} oldBefore={oldBefore} show={show} onCreate={(text) => createComponent(i, text)} enterNext
                onChange={(itemId) => setForm(pickComponent(st, i, itemId))} />
              {/* Enter in any of its boxes (a unit picked, ε set) goes on to "+ add component": amount, Enter, next. */}
              <div className="row" onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); addComponentRef.current?.focus() } }}>
                <input ref={(el) => (componentAmountRefs.current[i] = el)} inputMode="decimal" placeholder="amount" value={c.amount} onChange={(e) => setC(i, { amount: e.target.value })} />
                <DeltaInput value={c.amountDelta} amount={c.amount} unit={c.unit} onChange={(v) => setC(i, { amountDelta: v })} />
                <UnitCombo units={componentUnits(ctx, c)} value={c.unit} onChange={(u) => setC(i, { unit: u })} />
                <EntryErrorButton value={c.entryError ?? DEFAULT_ENTRY_ERROR} onChange={(x) => setC(i, { entryError: x })} />
                <button className="icon" onClick={() => setForm((f) => ({ ...f, components: f.components.filter((_, j) => j !== i) }))} aria-label="Remove">×</button>
              </div>
              {/* What this component brings in, live, once it has a food and an amount. */}
              {st.componentNutrients[i] && <MacroLine nutrients={st.componentNutrients[i].nutrients} ok={st.componentNutrients[i].ok} deltas />}
            </li>
          ))}
          <li className="add" ref={addComponentRef} {...pressable(() => setForm((f) => ({ ...f, components: [...f.components, newComponent()] })), { focusOnClick: true, scrollUp: true })}>+ add component</li>
        </ul>

        <div className="row amount-row">
          <Field label="Per amount">
            <input inputMode="decimal" value={form.amount} placeholder="1" onChange={(e) => set('amount')(e.target.value)} />
          </Field>
          <Field label="± Δ">
            <DeltaInput value={form.amountDelta} amount={form.amount} unit={form.unit} onChange={set('amountDelta')} />
          </Field>
          <Field label="Unit"><UnitInput value={form.unit} placeholder="portion" onChange={set('unit')} /></Field>
        </div>
        {hasComponents && (
          <p className="small">
            {total.problem
              ? <span className="muted">Can't add up the components: {total.problem}</span>
              : <><button className="link" onClick={autoAmount}>Auto</button>{' '}
                <span className="muted">sum of components: {round(total.value, 6)} ± {round(total.delta, 3)} {totalUnit}</span></>}
          </p>
        )}
        <p>Per {amt} {unit}: <MacroLine nutrients={preview.nutrients} ok={preview.ok} deltas /></p>

        {hasComponents ? (
          <p className="muted">Nutrients are inferred from the components.</p>
        ) : (
          <>
            <h3>Nutrients</h3>
            <div className="nutrients">
              <div className="n-row one-value n-head"><span /><span>value</span><span /></div>
              {nutrientRowsShown(form, extraShown).shown.map((n) => {
                const f = form.nutrients[n.key]
                return (
                  <div className="n-row one-value" key={n.key}>
                    <span>{n.label} <small className="muted">{n.unit}</small></span>
                    <input ref={(el) => (valueRefs.current[n.key] = el)} inputMode="decimal" value={f.text} placeholder={n.default === 0 ? '0' : 'NaN'} enterKeyHint="next" onKeyDown={enterTo(adderRef)} onChange={(e) => setN(n.key, 'text', e.target.value)} />
                    {CORE.includes(n.key) ? <span /> : (
                      <button className="icon small" aria-label={`Remove ${n.label}`} onClick={() => removeNutrient(n.key)}>×</button>
                    )}
                  </div>
                )
              })}
              {(() => {
                const { hidden } = nutrientRowsShown(form, extraShown)
                return hidden.length > 0 && <NutrientAdder inputRef={adderRef} options={hidden} onAdd={(key) => { setExtraShown((s) => [...s, key]); setFocusKey(key) }} />
              })()}
            </div>
          </>
        )}

        {/* Last: it only matters once the food is known to be a nutrients entry, not components. */}
        {!hasComponents && (
          <Field label="Category (how much its values vary)">
            <Select value={form.category} options={CATEGORY_OPTIONS} onChange={set('category')} enterNext />
          </Field>
        )}

        <div className="row actions">
          {initial && <button className="danger" onClick={remove}>Delete</button>}
          <button onClick={save}>Save</button>
        </div>
      </div>
  )
}
