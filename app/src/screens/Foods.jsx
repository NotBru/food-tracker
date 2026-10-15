import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, itemLabel, kindOf } from '../db'
import { baseAmount, loadContext, nutrientsFor } from '../calc'
import { NUTRIENTS, amountText, deltaFromInput, deltaText, emptyNutrients, measure, normalizeNumber } from '../nutrients'
import { toLocalInput } from '../time'
import { clearPendingDraft, peekPendingDraft, sourceLabel } from '../external'
import { AttributesEditor, DeltaInput, Field, ItemPicker, MacroLine, NutrientAdder, Screen, UnitInput, enterTo, go } from '../components'

// A food is anything you can eat: an ingredient, a recipe (has components) or a concoction (has a made-at time).
// One list, one editor; what kind a food is follows from its fields.

export function FoodList() {
  const [query, setQuery] = useState('')
  const ctx = useLiveQuery(loadContext)
  if (!ctx) return null
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const rows = ctx.list
    .map((r) => [r, itemLabel(r)])
    .filter(([, label]) => words.every((w) => label.toLowerCase().includes(w)))
    .sort(([a, la], [b, lb]) => (b.madeAt ?? '').localeCompare(a.madeAt ?? '') || la.localeCompare(lb))
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
                <span>{label}{kindOf(r) !== 'ingredient' && <small className="muted"> · {kindOf(r)}</small>}</span>
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

// --- Nutrient form helpers ---------------------------------------------------

// Always shown, on top. Everything else appears once it has a value (or is added from the picker).
const CORE = ['energy', 'proteins', 'fat', 'carbohydrates']
const isFilled = (f) => f.text.trim() !== '' || f.delta.trim() !== ''

function nutrientsToForm(nutrients) {
  const base = { ...emptyNutrients(), ...(nutrients ?? {}) }
  return Object.fromEntries(
    NUTRIENTS.map(({ key }) => {
      const n = base[key]
      const text = n.text ?? (Number.isFinite(n.value) ? String(n.value) : '')
      return [key, { text, delta: n.deltaAuto || !Number.isFinite(n.delta) ? '' : String(n.delta) }]
    }),
  )
}

function formToNutrients(form) {
  return Object.fromEntries(
    NUTRIENTS.map(({ key, default: def }) => {
      const { delta } = form[key]
      const text = normalizeNumber(form[key].text)
      const value = text.trim() === '' ? (def ?? NaN) : Number(text)
      const auto = delta.trim() === ''
      return [key, { value, delta: auto ? (text.trim() === '' && def === 0 ? 0 : deltaFromInput(text)) : Number(delta), text: text.trim(), deltaAuto: auto }]
    }),
  )
}

// --- Food editor ---------------------------------------------------------------

// Every amount has an error (± Δ). Blank = from the digits typed (nutrients.js `measure`).
// Amounts that are divided by (per amount, both sides of a unit) must keep their low end above 0.
function divisorProblem(label, m) {
  if (!(m.value > 0) || m.delta < m.value) return null
  return `${label}: ±${m.delta}${m.auto ? ' (from the digits)' : ''} would reach 0. Type more digits (e.g. ${m.value}.0) or set a smaller ±.`
}

export function FoodEditor({ id }) {
  const isNew = id === 'new'
  const data = useLiveQuery(async () => ({ id, ctx: await loadContext(), rec: isNew ? null : await db.items.get(Number(id)) }), [id])
  // useLiveQuery keeps the previous result while a new id loads; don't build the form from another food's data.
  if (!data || data.id !== id) return null
  if (!isNew && !data.rec) return <Screen title="Edit food"><p className="muted">Food not found (deleted?).</p></Screen>
  // A new food may come prefilled from "Search external" (draft handed over by external.js).
  return <FoodForm key={id} ctx={data.ctx} initial={data.rec} prefill={isNew ? peekPendingDraft() : null} />
}

function FoodForm({ ctx, initial, prefill }) {
  const src = initial ?? prefill
  const [form, setForm] = useState(() => ({
    name: src?.name ?? '',
    brand: src?.brand ?? '',
    attributes: src?.attributes ?? [],
    amount: src ? amountText(src.amount, src.amountText) : '100',
    amountDelta: src ? deltaText(src.amountDelta, src.amountDeltaAuto) : '',
    unit: src?.unit ?? (initial ? '' : 'g'),
    isMade: !!src?.madeAt,
    madeAt: toLocalInput(src?.madeAt ? new Date(src.madeAt) : new Date()),
    components: (src?.components ?? []).map((c) => ({
      ...c, amount: amountText(c.amount, c.amountText), amountDelta: deltaText(c.amountDelta, c.amountDeltaAuto),
    })),
    units: (src?.units ?? []).map((u) => ({
      ...u,
      fromAmount: amountText(u.fromAmount, u.fromText), fromDelta: deltaText(u.fromDelta, u.fromDeltaAuto),
      toAmount: amountText(u.toAmount, u.toText), toDelta: deltaText(u.toDelta, u.toDeltaAuto),
    })),
    nutrients: nutrientsToForm(src?.nutrients),
    source: src?.source ?? null,
  }))
  useEffect(() => { if (prefill) clearPendingDraft() }, [prefill])
  // Extra (non-core) nutrients shown even while empty, because the user just added them.
  const [extraShown, setExtraShown] = useState([])
  // Nutrient just added: its value field gets the cursor once the row exists.
  const [focusKey, setFocusKey] = useState(null)
  const valueRefs = useRef({})
  const adderRef = useRef(null) // Enter in a nutrient's value or Δ goes here
  // Optional nutrients only: clears value and Δ (so it's stored as NaN again) and hides the row.
  const removeNutrient = (key) => {
    setForm((f) => ({ ...f, nutrients: { ...f.nutrients, [key]: { text: '', delta: '' } } }))
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

  function toRecord() {
    const base = measure(form.amount, form.amountDelta)
    return {
      name: form.name.trim(), brand: form.brand.trim(), attributes: form.attributes,
      amount: base.value > 0 ? base.value : NaN, amountText: base.text, amountDelta: base.delta, amountDeltaAuto: base.auto,
      unit: form.unit.trim(),
      madeAt: form.isMade ? new Date(form.madeAt).toISOString() : null,
      units: form.units
        .filter((u) => Number(u.fromAmount) > 0 && u.fromUnit.trim() && Number(u.toAmount) > 0 && u.toUnit.trim())
        .map((u) => {
          const a = measure(u.fromAmount, u.fromDelta)
          const b = measure(u.toAmount, u.toDelta)
          return {
            fromAmount: a.value, fromText: a.text, fromDelta: a.delta, fromDeltaAuto: a.auto, fromUnit: u.fromUnit.trim(),
            toAmount: b.value, toText: b.text, toDelta: b.delta, toDeltaAuto: b.auto, toUnit: u.toUnit.trim(),
          }
        }),
      components: form.components.filter((c) => c.itemId != null)
        .map((c) => {
          const m = measure(c.amount, c.amountDelta)
          return { itemId: c.itemId, amount: m.value, amountText: m.text, amountDelta: m.delta, amountDeltaAuto: m.auto, unit: c.unit.trim() }
        }),
      nutrients: formToNutrients(form.nutrients),
      source: form.source,
    }
  }

  const draft = { ...toRecord(), id: initial?.id ?? -1 }
  const hasComponents = draft.components.length > 0
  // Live preview: compute with the unsaved form swapped into the context.
  const previewCtx = { ...ctx, items: new Map(ctx.items).set(draft.id, draft) }
  const [amt, unit] = baseAmount(draft)
  const preview = nutrientsFor(previewCtx, draft.id, amt, unit)

  async function save() {
    const rec = toRecord()
    if (!rec.name) return alert('Name is required.')
    const problem = [
      divisorProblem('Per amount', measure(form.amount, form.amountDelta)),
      ...rec.units.flatMap((u) => [
        divisorProblem(`Units: ${u.fromText} ${u.fromUnit}`, { value: u.fromAmount, delta: u.fromDelta, auto: u.fromDeltaAuto }),
        divisorProblem(`Units: ${u.toText} ${u.toUnit}`, { value: u.toAmount, delta: u.toDelta, auto: u.toDeltaAuto }),
      ]),
    ].find(Boolean)
    if (problem) return alert(problem)
    if (initial) await db.items.update(initial.id, rec)
    else await db.items.add(rec)
    history.back()
  }
  async function remove() {
    if (confirm('Delete this food? Consumptions and recipes using it will show it as missing.')) {
      await db.items.delete(initial.id)
      history.back()
    }
  }

  return (
    <Screen title={initial ? 'Edit food' : 'New food'}>
      <div className="form">
        {!initial && (
          <button className="secondary" onClick={() => go(`/foods/external${form.name.trim() ? `?q=${encodeURIComponent(form.name.trim())}` : ''}`)}>
            Search external databases…
          </button>
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
        <div className="row amount-row">
          <Field label="Per amount">
            <input inputMode="decimal" value={form.amount} placeholder="1" onChange={(e) => set('amount')(e.target.value)} />
          </Field>
          <Field label="± Δ">
            <DeltaInput value={form.amountDelta} amount={form.amount} onChange={set('amountDelta')} />
          </Field>
          <Field label="Unit"><UnitInput value={form.unit} placeholder="portion" onChange={set('unit')} /></Field>
        </div>

        <h3>Units</h3>
        <ul className="list compact">
          {form.units.map((u, i) => (
            <li key={i} className="component">
              {/* Two lines: "1 ± Δ slice" / "= 30 ± Δ g". */}
              <div className="row conv">
                <span className="conv-eq" />
                <input inputMode="decimal" value={u.fromAmount} onChange={(e) => setU(i, { fromAmount: e.target.value })} />
                <DeltaInput value={u.fromDelta} amount={u.fromAmount} onChange={(v) => setU(i, { fromDelta: v })} />
                <UnitInput value={u.fromUnit} placeholder="slice" onChange={(v) => setU(i, { fromUnit: v })} />
                <button className="icon" onClick={() => setForm((f) => ({ ...f, units: f.units.filter((_, j) => j !== i) }))} aria-label="Remove">×</button>
              </div>
              <div className="row conv">
                <span className="conv-eq">=</span>
                <input inputMode="decimal" value={u.toAmount} onChange={(e) => setU(i, { toAmount: e.target.value })} />
                <DeltaInput value={u.toDelta} amount={u.toAmount} onChange={(v) => setU(i, { toDelta: v })} />
                <UnitInput value={u.toUnit} onChange={(v) => setU(i, { toUnit: v })} />
                <span className="icon-gap" />
              </div>
            </li>
          ))}
          <li className="add" onClick={() => setForm((f) => ({ ...f, units: [...f.units, { fromAmount: '1', fromDelta: '0', fromUnit: '', toAmount: '', toDelta: '', toUnit: f.unit.trim() || 'g' }] }))}>+ add unit</li>
        </ul>
        <p className="muted small">g/kg/mg/oz/lb and ml/l/cl/dl/tsp/tbsp/cup convert automatically.</p>

        <label className="check">
          <input type="checkbox" checked={form.isMade} onChange={(e) => set('isMade')(e.target.checked)} />
          <span>Made at a specific time (concoction)</span>
        </label>
        {form.isMade && (
          <Field label="Made at"><input type="datetime-local" value={form.madeAt} onChange={(e) => set('madeAt')(e.target.value)} /></Field>
        )}

        <h3>Components</h3>
        <ul className="list compact">
          {form.components.map((c, i) => (
            <li key={i} className="component">
              <ItemPicker ctx={ctx} value={c.itemId} exclude={initial?.id}
                onChange={(itemId) => setC(i, { itemId, unit: c.unit || ctx.items.get(itemId)?.unit || 'portion' })} />
              <div className="row">
                <input inputMode="decimal" placeholder="amount" value={c.amount} onChange={(e) => setC(i, { amount: e.target.value })} />
                <DeltaInput value={c.amountDelta} amount={c.amount} onChange={(v) => setC(i, { amountDelta: v })} />
                <UnitInput value={c.unit} onChange={(u) => setC(i, { unit: u })} />
                <button className="icon" onClick={() => setForm((f) => ({ ...f, components: f.components.filter((_, j) => j !== i) }))} aria-label="Remove">×</button>
              </div>
            </li>
          ))}
          <li className="add" onClick={() => setForm((f) => ({ ...f, components: [...f.components, { itemId: null, amount: '', amountDelta: '', unit: '' }] }))}>+ add component</li>
        </ul>

        <p>Per {amt} {unit}: <MacroLine nutrients={preview.nutrients} ok={preview.ok} deltas /></p>

        {hasComponents ? (
          <p className="muted">Nutrients are inferred from the components.</p>
        ) : (
          <>
            <h3>Nutrients</h3>
            <div className="nutrients">
              <div className="n-row with-x n-head"><span /><span>value</span><span>Δ</span><span /></div>
              {[...CORE.map((k) => NUTRIENTS.find((n) => n.key === k)), ...NUTRIENTS.filter((n) => !CORE.includes(n.key) && (isFilled(form.nutrients[n.key]) || extraShown.includes(n.key)))].map((n) => {
                const f = form.nutrients[n.key]
                return (
                  <div className="n-row with-x" key={n.key}>
                    <span>{n.label} <small className="muted">{n.unit}</small></span>
                    <input ref={(el) => (valueRefs.current[n.key] = el)} inputMode="decimal" value={f.text} placeholder={n.default === 0 ? '0' : 'NaN'} enterKeyHint="next" onKeyDown={enterTo(adderRef)} onChange={(e) => setN(n.key, 'text', e.target.value)} />
                    <input inputMode="decimal" value={f.delta} placeholder={f.text ? String(+deltaFromInput(f.text).toPrecision(3)) : n.default === 0 ? '0' : 'auto'} enterKeyHint="next" onKeyDown={enterTo(adderRef)} onChange={(e) => setN(n.key, 'delta', e.target.value)} />
                    {CORE.includes(n.key) ? <span /> : (
                      <button className="icon small" aria-label={`Remove ${n.label}`} onClick={() => removeNutrient(n.key)}>×</button>
                    )}
                  </div>
                )
              })}
              {(() => {
                const hidden = NUTRIENTS.filter((n) => !CORE.includes(n.key) && !isFilled(form.nutrients[n.key]) && !extraShown.includes(n.key))
                return hidden.length > 0 && <NutrientAdder inputRef={adderRef} options={hidden} onAdd={(key) => { setExtraShown((s) => [...s, key]); setFocusKey(key) }} />
              })()}
            </div>
          </>
        )}

        <div className="row actions">
          {initial && <button className="danger" onClick={remove}>Delete</button>}
          <button onClick={save}>Save</button>
        </div>
      </div>
    </Screen>
  )
}
