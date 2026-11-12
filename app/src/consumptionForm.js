// The consumption editor's logic (screens/Consumptions.jsx ConsumptionEditor, and the Android app's native one
// through native/core.js): the form as typed, what it adds up to, and saving it. No UI here.
import { db, expiresAt, itemLabel, parseExpiryDays } from './db'
import { componentsTotal, concoctionsLeft, consumptionNutrients, keepUnit, lastEntryError, nutrientsFor, resolve, unitsFor, usedUp } from './calc'
import { addDays, dayBounds, toLocalInput, today } from './time'
import { NUTRIENTS, amountText, deltaText, emptyNutrients, measure, normalizeNumber } from './nutrients'
import { DEFAULT_ENTRY_ERROR } from './errors'
import { t } from './i18n'

// --- New concoction from the consumption sheet --------------------------------------------------------------
// Ticking "New concoction" on a new consumption swaps the food picker for a name and components. Saving adds the
// concoction (made at the consumption's time, its amount the sum of the components, like the food editor's Auto)
// and the consumption of it. A blank amount eaten means all of it, exactly. An existing concoction is edited under Foods.

export const DRAFT_ID = -1
export const round = (x, digits) => String(Number(x.toPrecision(digits)))
export const emptyComponent = () => ({ itemId: null, amount: '', amountDelta: '', unit: '' })
const pctText = (x) => String(+(x * 100).toPrecision(6))

/** A new consumption on `day`: now if it's today, otherwise noon of that day. */
export function newConsumption(day, dayStart, userId) {
  const dt = day === today(dayStart) ? new Date() : new Date(`${day}T12:00`)
  return { datetime: dt.toISOString(), userId, itemId: null, amount: '', unit: '' }
}

/** The form for `consumption` (a stored one, or a new one), its texts as typed. */
export function initialForm(consumption) {
  return {
    ...consumption,
    datetime: toLocalInput(new Date(consumption.datetime)),
    amount: amountText(consumption.amount, consumption.amountText),
    amountDelta: deltaText(consumption.amountDelta, consumption.amountDeltaAuto),
    // In %; blank = the default.
    entryError: pctText(Number.isFinite(consumption.entryError) ? consumption.entryError : DEFAULT_ENTRY_ERROR),
    concoction: false, name: '', brand: '', attributes: [], expiresAfterDays: '', components: [emptyComponent()],
  }
}

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
  if (!components.length) return { problem: t('add a component') }
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

/**
 * Everything the editor shows and saves, from the form: `savedCtx` (calc.js loadContext), every user's `logs`, the
 * `consumption` being edited (its id, if stored) and `dayStart`.
 */
export function editorState(savedCtx, logs, consumption, form, dayStart) {
  // Concoctions made before yesterday (logical days) are likely eaten up: listed after every other food.
  const oldBefore = dayBounds(addDays(today(dayStart), -1), dayStart)[0].toISOString()
  // Concoctions eaten up, or expired at the consumption's time, aren't offered. What this consumption took is counted
  // back in, so editing it still finds its food.
  const left = concoctionsLeft(savedCtx, logs ?? [], consumption.id)
  const at = new Date(form.datetime)
  const atIso = Number.isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString()
  const show = (it) => !it.madeAt || (expiresAt(it) > atIso && !usedUp(left.get(it.id)))
  // "Max": the rest of the picked concoction, in its own unit, with no error of its own (like "all of it").
  const rest = !form.concoction && left.get(form.itemId)
  const maxText = rest && rest.value > 0 ? round(rest.value, 6) : null
  // The concoction is computed like a saved food: the draft is swapped into the context, under a placeholder id
  // while new.
  const draft = form.concoction ? concoctionDraft(savedCtx, form) : null
  const ctx = draft && !draft.problem ? { ...savedCtx, items: savedCtx.items.with(DRAFT_ID, { ...draft, id: DRAFT_ID }) } : savedCtx
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
  const picked = resolve(savedCtx, form.itemId)
  const ownFood = !form.concoction && !picked?.components?.length
  const typedError = Number(normalizeNumber(form.entryError))
  const logError = ownFood && form.entryError.trim() && typedError >= 0 ? typedError / 100 : undefined
  const preview = itemId != null && amount > 0 && unit
    ? consumptionNutrients(ctx, { itemId, amount, unit, amountDelta: m.delta, entryError: logError }) : null
  // What each component brings in, live, as in the food editor.
  const componentNutrients = form.concoction ? form.components.map((c) => {
    const cm = measure(c.amount, c.amountDelta, c.unit)
    if (c.itemId == null || !(cm.value >= 0)) return null
    return nutrientsFor(savedCtx, c.itemId, cm.value, c.unit.trim(), cm.delta, undefined, c.entryError)
  }) : []
  const total = !draft ? null : draft.problem ? `${t('Total:')} ${draft.problem}`
    : `${t('Total:')} ${draft.sum.problem ?? `${draft.sum.amountText} ± ${draft.sum.amountDelta} ${draft.sum.unit}`}`
  return {
    savedCtx, logs, consumption, form, oldBefore, left, show, rest, maxText, draft, ctx, itemId, m, unit, amount,
    picked, ownFood, logError, preview, componentNutrients, total,
  }
}

/** The form with food `itemId` picked: a unit that fits it, and the entry error it was last logged with. */
export const pickItem = (st, itemId) => ({
  ...st.form, itemId, unit: keepUnit(st.ctx, itemId, st.form.unit), entryError: pctText(lastEntryError(st.savedCtx, st.logs, itemId)),
})

/** Component `i` set to food `id`. */
export const pickComponent = (st, i, id) => setComponent(st.form, i, {
  itemId: id, unit: keepUnit(st.savedCtx, id, st.form.components[i].unit) ?? '', entryError: lastEntryError(st.savedCtx, st.logs, id, true),
})

export const setComponent = (form, i, patch) => ({ ...form, components: form.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

/** "New concoction" ticked or not. The amount eaten starts as "all of it"; a unit typed for the picked food may not
 * fit the concoction. */
export const toggleConcoction = (st, on) => ({
  ...st.form, concoction: on, amount: '', amountDelta: '', unit: on ? '' : keepUnit(st.savedCtx, st.form.itemId, st.form.unit) ?? '',
})

/** The form with "Max" pressed: the rest of the picked concoction. */
export const takeMax = (st) => ({ ...st.form, amount: st.maxText, amountDelta: '0', unit: st.rest.unit })

/** Units the amount can be in (null until there's a food), and a component's. */
export const unitsOf = (st) => (st.itemId != null ? unitsFor(st.ctx, st.itemId) : null)
export const componentUnits = (st, c) => (c.itemId != null ? unitsFor(st.savedCtx, c.itemId) : null)

/**
 * What stops saving: {alert} (can't), {confirm} (asks first; saving with `confirmed` goes ahead), or null.
 */
export function saveProblem(st, confirmed = false) {
  const { form, amount, unit, draft, ctx } = st
  if (form.concoction) {
    if (!form.name.trim()) return { alert: t('The concoction needs a name.') }
    if (draft.problem) return { alert: `${t("Can't add up the components: {problem}", { problem: draft.problem })}.` }
    if (form.components.some((c) => c.itemId != null && !(measure(c.amount, c.amountDelta, c.unit).value >= 0))) {
      return { alert: t('Every component needs an amount.') }
    }
    if (!(amount > 0) || !unit.trim()) return { alert: t('Amount eaten must be above 0 (leave it blank for all of it).') }
    if (!unitsFor(ctx, DRAFT_ID).includes(unit.trim().toLowerCase())) return { alert: t("“{unit}” doesn't convert to {to}.", { unit: unit.trim(), to: draft.unit }) }
    return null
  }
  if (form.itemId == null || !(amount > 0) || !form.unit.trim()) return { alert: t('Item, amount and unit are required.') }
  const u = form.unit.trim()
  if (!confirmed && !unitsFor(ctx, form.itemId).includes(u.toLowerCase())) {
    return { confirm: t("“{unit}” doesn't convert for this food, so its nutrients can't be computed (add it under the food's Units). Save anyway?", { unit: u }) }
  }
  return null
}

/** Saves the form (saveProblem first): the consumption, or the new concoction and the consumption of it. */
export async function save(st) {
  const { form, consumption, amount, m, unit, draft, logError } = st
  if (form.concoction) {
    const { sum, id, ...rec } = draft
    const log = { datetime: new Date(form.datetime).toISOString(), userId: consumption.userId,
      amount, amountText: m.text, amountDelta: m.delta, amountDeltaAuto: m.auto, unit: unit.trim() }
    await db.transaction('rw', db.items, db.logs, async () => {
      await db.logs.add({ ...log, itemId: await db.items.add(rec) })
    })
    return
  }
  const rec = {
    datetime: new Date(form.datetime).toISOString(), userId: consumption.userId, itemId: form.itemId,
    amount, amountText: m.text, amountDelta: m.delta, amountDeltaAuto: m.auto, unit: form.unit.trim(),
    entryError: logError,
  }
  if (consumption.id) await db.logs.update(consumption.id, rec)
  else await db.logs.add(rec)
}

/** "Delete “Oats” at 08:30?" for a consumption of `item`. */
export const deleteQuestion = (consumption, item) =>
  t(item ? 'Delete “{food}” at {time}?' : 'Delete this entry at {time}?', { food: item && itemLabel(item), time: toLocalInput(new Date(consumption.datetime)).slice(11) })

/** Every nutrient known for a consumption but energy (NutrientDetails): those no food in it has a value for left out. */
export const detailRows = (nutrients) =>
  NUTRIENTS.filter(({ key }) => key !== 'energy' && nutrients[key] && !(nutrients[key].missing && nutrients[key].value === 0))

// --- New food from the editor ("+ register food" under its search box) -----------------------------------------
// The editor's consumption and form are stashed with the hash it's on, a new food opens on top
// (`/foods/new?for=consumption`), and back on that hash the editor opens again as it was, the new food (if it was
// saved) picked. In memory only, like the foods editor's `parents`: a reload drops it.
let stash = null // { hash, consumption, form, created }

export const stashForNewFood = (consumption, form) => (stash = { hash: location.hash, consumption, form, created: null })
/** The new food saved: the stashed editor picks it. */
export const newFoodSaved = (id) => stash && (stash.created = id)
/** The stash, if it belongs to this hash (left in place: drop it with dropStash once used). */
export const stashHere = () => (stash?.hash === location.hash ? stash : null)
export const dropStash = (s) => stash === s && (stash = null)
/** The stashed form, with the new food picked if there is one; `st`: the editor's state for the stashed form. */
export const restoredForm = (st, s) => (s.created != null && st.ctx.items.get(s.created) ? pickItem(st, s.created) : s.form)
