// The food editor's logic (screens/Foods.jsx FoodForm, and the Android app's native one through native/core.js): the
// form as typed, the record it makes, what it adds up to, and saving it. No UI here.
import { conflictingFoods, db, expiresAt, findEqualFood, mergeEqualFoodsInDb, parseExpiryDays } from './db'
import { baseAmount, componentsTotal, concoctionsLeft, keepUnit, lastEntryError, nutrientsFor, unitsFor, usedUp } from './calc'
import { NUTRIENTS, amountText, deltaFromInput, deltaText, emptyNutrients, measure, normalizeNumber } from './nutrients'
import { CATEGORY_GROUPS } from './errors'
import { addDays, dayBounds, toLocalInput, today } from './time'

export const CATEGORY_OPTIONS = [
  { value: '', label: 'Unknown' },
  ...CATEGORY_GROUPS.flatMap(([, group, subs]) => subs.map(([code, label]) => ({ value: code, label, group }))),
]

// --- Nutrient form helpers ---------------------------------------------------

// Always shown, on top. Everything else appears once it has a value (or is added from the picker).
export const CORE = ['energy', 'proteins', 'fat', 'carbohydrates']
export const isFilled = (f) => f.text.trim() !== ''

function nutrientsToForm(nutrients) {
  const base = { ...emptyNutrients(), ...(nutrients ?? {}) }
  return Object.fromEntries(
    NUTRIENTS.map(({ key }) => {
      const n = base[key]
      const text = n.text ?? (Number.isFinite(n.value) ? String(n.value) : '')
      return [key, { text }]
    }),
  )
}

// A value's error is the model's (calc.js): its category's spread and its digits. The digits' Δ is still stored.
function formToNutrients(form) {
  return Object.fromEntries(
    NUTRIENTS.map(({ key, default: def }) => {
      const text = normalizeNumber(form[key].text)
      const value = text.trim() === '' ? (def ?? NaN) : Number(text)
      return [key, { value, delta: text.trim() === '' && def === 0 ? 0 : deltaFromInput(text), text: text.trim(), deltaAuto: true }]
    }),
  )
}

/** The nutrient rows shown: the core ones, then those with a value or just added (`extraShown`); and the others,
 * which "+ add nutrient" offers. */
export function nutrientRowsShown(form, extraShown) {
  const shown = [...CORE.map((k) => NUTRIENTS.find((n) => n.key === k)),
    ...NUTRIENTS.filter((n) => !CORE.includes(n.key) && (isFilled(form.nutrients[n.key]) || extraShown.includes(n.key)))]
  const hidden = NUTRIENTS.filter((n) => !CORE.includes(n.key) && !isFilled(form.nutrients[n.key]) && !extraShown.includes(n.key))
  return { shown, hidden }
}

// --- The form ------------------------------------------------------------------

/** The form for `src` (a stored food, a read-only one or an external draft to copy, or nothing: a new food).
 * `stored`: it's the food being edited. `name`: a new food's name (a new component, named from what was typed). */
export function initialForm(src, stored, name) {
  return {
    name: src?.name ?? name ?? '',
    brand: src?.brand ?? '',
    attributes: src?.attributes ?? [],
    amount: src ? amountText(src.amount, src.amountText) : '100',
    amountDelta: src ? deltaText(src.amountDelta, src.amountDeltaAuto) : '',
    unit: src?.unit ?? (stored ? '' : 'g'),
    isMade: !!src?.madeAt,
    madeAt: toLocalInput(src?.madeAt ? new Date(src.madeAt) : new Date()),
    expiresAfterDays: src?.expiresAfterDays > 0 ? String(src.expiresAfterDays) : '',
    category: src?.category ?? '',
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
  }
}

/** The food as it would be stored. */
export function toRecord(form) {
  const base = measure(form.amount, form.amountDelta, form.unit)
  const composed = form.components.some((c) => c.itemId != null)
  return {
    name: form.name.trim(), brand: form.brand.trim(), attributes: form.attributes,
    amount: base.value > 0 ? base.value : NaN, amountText: base.text, amountDelta: base.delta, amountDeltaAuto: base.auto,
    unit: form.unit.trim(),
    madeAt: form.isMade ? new Date(form.madeAt).toISOString() : null,
    expiresAfterDays: form.isMade ? parseExpiryDays(form.expiresAfterDays) : undefined,
    // Only a food of its own has a category; a recipe's error comes from its components.
    category: !composed && form.category ? form.category : undefined,
    units: form.units
      .filter((u) => Number(u.fromAmount) > 0 && u.fromUnit.trim() && Number(u.toAmount) > 0 && u.toUnit.trim())
      .map((u) => {
        const a = measure(u.fromAmount, u.fromDelta, u.fromUnit)
        const b = measure(u.toAmount, u.toDelta, u.toUnit)
        return {
          fromAmount: a.value, fromText: a.text, fromDelta: a.delta, fromDeltaAuto: a.auto, fromUnit: u.fromUnit.trim(),
          toAmount: b.value, toText: b.text, toDelta: b.delta, toDeltaAuto: b.auto, toUnit: u.toUnit.trim(),
        }
      }),
    components: form.components.filter((c) => c.itemId != null)
      .map((c) => {
        const m = measure(c.amount, c.amountDelta, c.unit)
        return {
          itemId: c.itemId, amount: m.value, amountText: m.text, amountDelta: m.delta, amountDeltaAuto: m.auto, unit: c.unit.trim(),
          entryError: Number.isFinite(c.entryError) ? c.entryError : undefined,
        }
      }),
    nutrients: formToNutrients(form.nutrients),
    source: form.source,
  }
}

export const round = (x, digits) => String(Number(x.toPrecision(digits)))

/**
 * Everything the editor shows, from the form: `ctx` (calc.js loadContext), every user's `logs`, the stored food
 * being edited (`initial`, or null) and `dayStart`.
 */
export function editorState(ctx, logs, form, initial, dayStart) {
  // Components are offered as in the consumption form: concoctions eaten up, or expired when this one is made (now,
  // for a plain food), left out; ones made before yesterday (logical days) last. What this food took is counted back.
  const oldBefore = dayBounds(addDays(today(dayStart), -1), dayStart)[0].toISOString()
  const left = concoctionsLeft(ctx, logs ?? [], null, initial?.id)
  const at = new Date(form.isMade ? form.madeAt : Date.now())
  const atIso = Number.isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString()
  const show = (it) => !it.madeAt || (expiresAt(it) > atIso && !usedUp(left.get(it.id)))
  const draft = { ...toRecord(form), id: initial?.id ?? -1 }
  const hasComponents = draft.components.length > 0
  // Live preview: compute with the unsaved form swapped into the context.
  const previewCtx = { ...ctx, items: ctx.items.with(draft.id, draft) }
  const [amt, unit] = baseAmount(draft)
  const preview = nutrientsFor(previewCtx, draft.id, amt, unit)
  // "Auto" per amount: the components added up, in the food's unit (g if it has none yet).
  const totalUnit = form.unit.trim() || 'g'
  const total = hasComponents && componentsTotal(ctx, draft.components, totalUnit)
  // What each component brings in, live, once it has a food and an amount.
  const componentNutrients = form.components.map((c) => {
    const m = measure(c.amount, c.amountDelta, c.unit)
    if (c.itemId == null || !(m.value >= 0)) return null
    return nutrientsFor(ctx, c.itemId, m.value, c.unit.trim(), m.delta, undefined, c.entryError)
  })
  return { ctx, logs, form, initial, oldBefore, show, draft, hasComponents, amt, unit, preview, totalUnit, total, componentNutrients }
}

/** The form with component `i` set to food `itemId`: a unit that fits, the entry error it last had. */
export const pickComponent = (st, i, itemId) => ({
  ...st.form,
  components: st.form.components.map((c, j) => (j === i
    ? { ...c, itemId, unit: keepUnit(st.ctx, itemId, c.unit) ?? '', entryError: lastEntryError(st.ctx, st.logs, itemId, true) } : c)),
})

/** "Auto": the per amount set to the components' sum. */
export const autoAmount = (st) => ({ ...st.form, amount: round(st.total.value, 6), amountDelta: round(st.total.delta, 3), unit: st.totalUnit })

export const newUnit = (form) => ({ fromAmount: '1', fromDelta: '0', fromUnit: '', toAmount: '', toDelta: '', toUnit: form.unit.trim() || 'g' })
export const newComponent = () => ({ itemId: null, amount: '', amountDelta: '', unit: '' })

/** A stashed form, with the food made from it (if saved) set as the component it was made for. */
export function withCreated(ctx, form, index, created) {
  if (created == null || !form.components[index]) return form
  const unit = form.components[index].unit || ctx.items.get(created)?.unit || 'portion'
  return { ...form, components: form.components.map((c, j) => (j === index ? { ...c, itemId: created, unit } : c)) }
}

/** Units a component can be in (null until it has a food). */
export const componentUnits = (ctx, c) => (c.itemId != null ? unitsFor(ctx, c.itemId) : null)

// Every amount has an error (± Δ). Blank = from the digits typed (nutrients.js `measure`).
// Amounts that are divided by (per amount, both sides of a unit) must keep their low end above 0.
function divisorProblem(label, m) {
  if (!(m.value > 0) || m.delta < m.value) return null
  return `${label}: ±${m.delta}${m.auto ? ' (from the digits)' : ''} would reach 0. Type more digits (e.g. ${m.value}.0) or set a smaller ±.`
}

/** What stops saving (an alert's text), or null. */
export function saveProblem(form) {
  const rec = toRecord(form)
  if (!rec.name) return 'Name is required.'
  return [
    divisorProblem('Per amount', measure(form.amount, form.amountDelta, form.unit)),
    ...rec.units.flatMap((u) => [
      divisorProblem(`Units: ${u.fromText} ${u.fromUnit}`, { value: u.fromAmount, delta: u.fromDelta, auto: u.fromDeltaAuto }),
      divisorProblem(`Units: ${u.toText} ${u.toUnit}`, { value: u.toAmount, delta: u.toDelta, auto: u.toDeltaAuto }),
    ]),
  ].find(Boolean) ?? null
}

/** Saves the form (saveProblem first): the stored food updated, or a new one. Returns the food's id. Saving a copy of
 * an existing food (same ID, same values) is ignored: the existing one is used. */
export async function save(ctx, form, initial) {
  const rec = toRecord(form)
  if (initial) {
    await db.items.update(initial.id, rec)
    await mergeEqualFoodsInDb()
    return initial.id
  }
  return findEqualFood(ctx.list, rec)?.id ?? await db.items.add(rec)
}

export const DELETE_QUESTION = 'Delete this food? Consumptions and recipes using it will show it as missing.'

/** Other foods with this one's ID (name, brand, attributes, made-at) but different values: their ids, or null. */
export const sameIdAs = (ctx, item) => conflictingFoods(ctx.list).get(item.id) ?? null
