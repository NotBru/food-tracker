// What the Android app's native screens ask the web app's logic for (through bridge.js). Each view returns what its
// screen shows, as plain JSON: texts already formatted and links as routes, so the Kotlin side only lays it out and
// no logic is copied there. One function per native screen; the web screen it replaces uses the same modules.
import { liveQuery } from 'dexie'
import { DEFAULT_EXPIRY_DAYS, NOTE_DAYS, conflictingFoods, db, expiresAt, exportAll, makeId, getConfig, getCurrentUser, importAll, itemLabel, kindOf, madeText } from '../db'
import { NUTRIENTS, amountText, autoAmountDelta, calories, fmt, normalizeNumber, pmText, rangeLabel, rangeText } from '../nutrients'
import { bounds, getCoverage, sdOf, setCoverage, zero } from '../stats'
import { WINDOWS, WINDOW_NAMES, addDays, dayBounds, daysBetween, formatDateTime, prettyDay, toLocalInput, today, versionStamp } from '../time'
import { energySplit } from '../energy'
import { nutrientRows } from '../screens/FoodInfo'
import { baseAmount, concoctionsLeft, consumptionNutrients, loadContext, nutrientsFor, resolve, span, targetBar, unitFactorSpan, unitsFor, usedUp } from '../calc'
import { DEFAULT_ENTRY_ERROR, categoryName } from '../errors'
import { foodListMatches, foodMatches } from '../search'
import * as cf from '../consumptionForm'
import { deleteNote as dropNote, leftText, saveNote as putNote, shrink } from '../notes'
import Dexie from 'dexie'
import * as ff from '../foodForm'
import * as forms from '../forms'
import { BUILTIN_FIELDS, lookalike, nameKey, nameMatches } from '../body'
import { DEFAULT_CONFIG, fold, searchText, setCurrentUser } from '../db'
import { clearPendingDraft, isBarcode, offDraft, offProductDraft, peekPendingDraft, searchOff, setPendingDraft, sourceLabel } from '../external'
import { ROWS } from '../dashboard'
import { exploreDbs, exploreFoods } from '../explore'
import * as bd from '../breakdown'
import * as gr from '../graphs'
import { barFor, exportFileName, fillEnd, fillPieces, ghostFor, hasMean, loadDashboard, statusMark, windowTitle } from '../dashboard'
import * as bk from '../backup'
import { conflictLabelShown, getState, status } from '../backup'
import { differingFields } from '../sync'
import qrcode from 'qrcode-generator'
import { TABLE_NAMES, rowLabel, shownValue, statusText } from '../screens/Backup'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const finite = (x) => (Number.isFinite(x) ? x : null)

/** The homescreen (screens/Home.jsx): `query` is its route's (`win`, `day`). */
export async function home(query = {}) {
  const config = await getConfig()
  setCoverage(config.coverage) // as App does (main.jsx) before any screen draws
  const day = today(config.dayStart)
  const win = WINDOWS.includes(query.win) ? query.win : WINDOWS[0]
  const winIdx = WINDOWS.indexOf(win)
  // As in Home.jsx: the day shown is at most tomorrow; today is no `day` at all.
  const inRange = (d) => d && d !== day && d <= addDays(day, 1)
  const picked = inRange(query.day) ? query.day : undefined
  const back = picked ? daysBetween(picked, day) : 0
  const view = (w, d) => {
    const qs = new URLSearchParams({ ...(w !== WINDOWS[0] && { win: w }), ...(inRange(d) && { day: d }) }).toString()
    return `/${qs ? `?${qs}` : ''}`
  }
  const data = await loadDashboard({ win, day, picked })
  const otherDay = win === 'daily' && back !== 0 ? data.first : null
  const rows = data.rows.map((r) => {
    const val = r.key === 'energy' ? calories(data.total) : data.total[r.key] ?? zero()
    const range = data.targets[r.key]
    const bar = barFor(r, val, range)
    const ghost = ghostFor(r, val, range, data.adj)
    const left = r.key === 'energy' && Number.isFinite(range?.max) ? range.max - bounds(val)[1] : null
    return {
      key: r.key, label: r.label, unit: r.unit, color: r.cls,
      value: `${val.estimated ? '~' : ''}${fmt(val.value, 0)}`,
      pm: pmText(val),
      err: sdOf(val) > 0 ? rangeText(val) : '',
      bar: bar && {
        status: bar.status, dummy: !!bar.dummy, minAt: finite(bar.minAt), maxAt: finite(bar.maxAt), fill: finite(bar.fill),
        end: finite(fillEnd(bar)), pieces: fillPieces(bar), mean: hasMean(bar),
      },
      ghost: ghost && ghost.to > ghost.from ? ghost : null,
      rangeLine: bar && !bar.dummy ? `${rangeLabel(range)} ${r.unit} ${statusMark(bar.status)}` : '',
      budget: left == null ? null : { text: `${left < 0 ? '−' : ''}${fmt(Math.abs(left), 0)}`, over: !(left > 0) },
      open: `/breakdown/${r.key}?from=${data.first}&to=${data.last}&win=${win}`,
    }
  })
  return {
    win, winName: WINDOW_NAMES[win], title: windowTitle(win, data.first, data.last, back), dots: WINDOWS.map((w) => w === win),
    daily: win === 'daily',
    prevWin: view(WINDOWS[(winIdx + WINDOWS.length - 1) % WINDOWS.length], picked),
    nextWin: view(WINDOWS[(winIdx + 1) % WINDOWS.length], picked),
    prevDay: view(win, addDays(picked ?? day, -1)),
    nextDay: back < 0 ? null : view(win, addDays(picked ?? day, 1)),
    todayView: back === 0 ? null : view(win),
    user: data.user.name,
    version: data.showVersion ? `v${versionStamp(__BUILT_AT__)}` : null,
    style: data.style,
    rows,
    summary: `${plural(data.count, 'consumption')}${win !== 'daily' ? ` · per day, over ${plural(data.days, 'day')} with consumptions` : ''}`,
    failed: data.failed > 0 ? `${data.failed} couldn't be computed` : null,
    consumptions: `/consumptions${otherDay ? `?day=${otherDay}` : ''}`,
    addConsumption: `/consumptions?${otherDay ? `day=${otherDay}&` : ''}new`,
  }
}

/** The sync icon (screens/Backup.jsx SyncStatus): its state (colour), what it means, and whether "Merge conflict" shows. */
export function syncStatus() {
  const s = getState()
  const st = status(s)
  return {
    state: st,
    text: `${statusText(s)} Tap to ${{ off: 'set it up', conflict: 'pick which to keep' }[st] ?? 'open Backup'}.`,
    label: st === 'conflict' && conflictLabelShown() ? 'Merge conflict' : null,
  }
}

/** Export databases: the file's name and text. */
export const exportFile = async () => ({ name: exportFileName(), text: await exportAll() })

/** Import databases: merge the file's text into what's here, or replace everything with it. */
export const importFile = (text, merge) => importAll(text, { merge })

/** For the Replace confirmation (Home.jsx ImportSheet): whether a backup is set up, so other devices are replaced too. */
export const backupOn = () => !!getState()

// --- Shared bits --------------------------------------------------------------------------------------------

/**
 * The latest value of `load` (a Dexie read), kept current by a live query once first asked for: for calls made on
 * every keystroke (an editor's view, a food search), which would otherwise read every food each time. Not for
 * watched views: a live query only follows the reads made inside it.
 */
function cached(load) {
  let latest = null
  let sub = null
  return () => {
    if (!sub) {
      latest = new Promise((resolve, reject) => {
        sub = liveQuery(load).subscribe({
          next: (v) => { latest = Promise.resolve(v); resolve(v) },
          error: (e) => { sub = null; reject(e) },
        })
      })
    }
    return latest
  }
}
const ctxNow = cached(() => loadContext())
const logsNow = cached(() => db.logs.toArray())

/** components.jsx MacroLine: "P 12 · F 5 · C 30 · 230 kcal", each part in its colour; with `deltas`, its ±. */
export function macroLine(nutrients, ok = true, deltas = false) {
  if (!ok) return { ok: false, parts: [] }
  const v = (k) => nutrients[k]?.value ?? 0
  const kcal = calories(nutrients)
  const pm = (n, digits) => (deltas && n ? pmText(n, digits) : null)
  return {
    ok: true,
    parts: [
      { color: 'c-prot', text: `P ${fmt(v('proteins'))}`, pm: pm(nutrients.proteins) },
      { color: 'c-fat', text: `F ${fmt(v('fat'))}`, pm: pm(nutrients.fat) },
      { color: 'c-carb', text: `C ${fmt(v('carbohydrates'))}`, pm: pm(nutrients.carbohydrates) },
      { color: 'c-kcal', text: `${kcal.estimated ? '~' : ''}${fmt(kcal.value, 0)}`, pm: pm(kcal, 0), after: ' kcal' },
    ],
  }
}

/** A food as a picker shows it: its label, "recipe", its made-at tag. */
const foodLabel = (it) => ({ id: it.id, label: itemLabel(it), recipe: kindOf(it) === 'recipe', made: madeText(it) || null })

/** Placeholder of a "± Δ" box (components.jsx DeltaInput): the error from the digits typed. */
const deltaPlaceholder = (amount, unit) => {
  const auto = autoAmountDelta(amount ?? '', unit)
  return Number.isFinite(auto) ? String(auto) : 'auto'
}

/**
 * The food picker's list for what's typed (components.jsx ItemPicker). `opts`: `exclude` (an id), `oldBefore`, and
 * for a consumption's picker `at` (its time) and `skipLog` (its id): concoctions eaten up or expired then are left out.
 */
export async function foodSearch(query, opts = {}) {
  const [ctx, logs] = await Promise.all([ctxNow(), logsNow()])
  let show
  if (opts.at !== undefined) {
    // As the editors' `show`: concoctions eaten up, or expired at `at`, left out; what the one being edited (a
    // consumption, `skipLog`, or a food, `skipItem`) took counted back in.
    const left = concoctionsLeft(ctx, logs, opts.skipLog ?? undefined, opts.skipItem ?? undefined)
    const at = new Date(opts.at ?? Date.now())
    const atIso = Number.isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString()
    show = (it) => !it.madeAt || (expiresAt(it) > atIso && !usedUp(left.get(it.id)))
  }
  return foodMatches(ctx, query, { exclude: opts.exclude ?? undefined, oldBefore: opts.oldBefore, show }).map(([it]) => foodLabel(it))
}

// --- Consumptions -------------------------------------------------------------------------------------------

/** screens/Consumptions.jsx: a day's consumptions, newest first. `query`: its route's (`day`). */
export async function consumptions(query = {}) {
  const config = await getConfig()
  const day = query.day || today(config.dayStart)
  const [start, end] = dayBounds(day, config.dayStart)
  const user = await getCurrentUser()
  const logs = await db.logs.where('[userId+datetime]').between([user.id, start.toISOString()], [user.id, end.toISOString()], true, false)
    .reverse().toArray()
  const ctx = await loadContext()
  return {
    day, title: prettyDay(day), user: user.name,
    prev: `/consumptions?day=${addDays(day, -1)}`,
    next: `/consumptions?day=${addDays(day, 1)}`,
    rows: logs.map((c) => {
      const item = resolve(ctx, c.itemId)
      const n = consumptionNutrients(ctx, c)
      return {
        id: c.id,
        label: item ? itemLabel(item) : '(deleted item)',
        made: madeText(item) || null,
        line: `${toLocalInput(new Date(c.datetime)).slice(11)} · ${amountText(c.amount, c.amountText)}${c.amountDeltaAuto === false ? ` ±${c.amountDelta}` : ''} ${c.unit}`,
        macros: macroLine(n.nutrients, n.ok, true),
        open: `/consumptions/${c.id}`,
        ask: cf.deleteQuestion(c, item),
      }
    }),
  }
}

export const deleteConsumption = (id) => db.logs.delete(id)

const editorEvents = {
  pick: (st, id) => cf.pickItem(st, id),
  concoction: (st, on) => cf.toggleConcoction(st, on),
  component: (st, [i, id]) => cf.pickComponent(st, i, id),
  addComponent: (st) => ({ ...st.form, components: [...st.form.components, cf.emptyComponent()] }),
  removeComponent: (st, i) => ({ ...st.form, components: st.form.components.filter((_, j) => j !== i) }),
  max: (st) => cf.takeMax(st),
}

async function editorFor(args) {
  const config = await getConfig()
  let { consumption, form } = args
  if (!consumption) {
    consumption = args.id ? await db.logs.get(args.id) : cf.newConsumption(args.day || today(config.dayStart), config.dayStart, (await getCurrentUser()).id)
    if (!consumption) throw new Error('This consumption was deleted.')
  }
  form ??= cf.initialForm(consumption)
  const [ctx, logs] = await Promise.all([ctxNow(), logsNow()])
  let st = cf.editorState(ctx, logs, consumption, form, config.dayStart)
  if (args.event) {
    const [name, arg] = args.event
    st = cf.editorState(ctx, logs, consumption, editorEvents[name](st, arg), config.dayStart)
  }
  return st
}

/**
 * The consumption editor (Consumptions.jsx ConsumptionEditor). `args`: to open it, `id` (a stored consumption) or
 * `day` (a new one on it); then `consumption` and `form` as this returned them, the form as typed since, and maybe an
 * `event` ([name, arg] of editorEvents) that changes it. Returns the consumption, the form and what to show.
 */
export async function consumptionEditor(args) {
  const st = await editorFor(args)
  const { form, consumption } = st
  const picked = (id, ctx) => {
    const it = id != null ? resolve(ctx, id) : null
    return it ? foodLabel(it) : null
  }
  const units = cf.unitsOf(st)
  const detail = st.preview?.ok ? cf.detailRows(st.preview.nutrients).map(({ key, label, unit }) => {
    const n = st.preview.nutrients[key]
    return { label, value: fmt(n.value, 2), pm: pmText(n, 2), unit, missing: !!n.missing }
  }) : null
  return {
    consumption, form,
    view: {
      title: consumption.id ? 'Edit consumption' : 'New consumption',
      isNew: !consumption.id,
      item: picked(form.itemId, st.ctx),
      amountLabel: form.concoction ? 'Amount eaten' : 'Amount',
      amountPlaceholder: form.concoction ? 'all' : null,
      deltaPlaceholder: deltaPlaceholder(form.amount, st.unit),
      units,
      ownFood: st.ownFood,
      entryErrorPlaceholder: fmt(DEFAULT_ENTRY_ERROR * 100),
      expiryPlaceholder: String(DEFAULT_EXPIRY_DAYS),
      max: st.maxText ? `Max: ${st.maxText} ${st.rest.unit} left` : null,
      preview: st.preview ? macroLine(st.preview.nutrients, st.preview.ok, true) : null,
      details: detail,
      components: form.concoction ? form.components.map((c, i) => ({
        item: picked(c.itemId, st.savedCtx),
        units: cf.componentUnits(st, c),
        deltaPlaceholder: deltaPlaceholder(c.amount, c.unit),
        entryError: fmt((c.entryError ?? DEFAULT_ENTRY_ERROR) * 100, 2),
        macros: st.componentNutrients[i] ? macroLine(st.componentNutrients[i].nutrients, st.componentNutrients[i].ok, true) : null,
      })) : [],
      total: st.total,
      save: form.concoction ? 'Add' : 'Save',
      search: { oldBefore: st.oldBefore, at: form.datetime, skipLog: consumption.id ?? null },
    },
  }
}

/** Saves the editor's form: {alert}, {confirm} (then again with `confirmed`), or {done}. */
export async function saveConsumption(args, confirmed = false) {
  const st = await editorFor(args)
  const problem = cf.saveProblem(st, confirmed)
  if (problem) return problem
  await cf.save(st)
  return { done: true }
}

// --- Info screens -------------------------------------------------------------------------------------------
// Rich text as spans: {t, b (bold), m (muted), c (a colour: warn, kcal, …), small}.

/** FoodInfo.jsx Amount: "50 ±1 g · 49–51 (±2%)". */
export function amountSpans(value, lo, hi, unit, delta) {
  const d = delta ?? Math.max(hi - value, value - lo)
  return [
    { t: fmt(value, 2), b: true },
    { t: `${d > 0 ? ` ±${fmt(d, 2)}` : ' (exact)'} ${unit}` },
    ...(d > 0 ? [{ t: ` · ${fmt(lo, 2)}–${fmt(hi, 2)} (±${fmt((d / value) * 100, 1)}%)`, m: true }] : []),
  ]
}

/** EnergyChart.jsx: the donut's slices and centre, the legend and the note. */
export function energyChart(nutrients) {
  const { macros, total, totalN } = energySplit(nutrients)
  const registered = calories(nutrients)
  const pct = (x) => (total > 0 ? `${fmt((x / total) * 100, 0)}%` : '')
  return {
    total: fmt(total, 0),
    totalPm: `${pmText(totalN, 0)} kcal`,
    slices: macros.flatMap((m) => m.slices.filter((s) => s.kcal > 0).map((s) => ({
      label: s.label, tone: s.tone, shade: s.shade, share: total > 0 ? s.kcal / total : 0,
      kcal: fmt(s.kcal, 0), pct: total > 0 ? fmt((s.kcal / total) * 100, 0) : '0',
    }))),
    legend: macros.flatMap((m) => [
      { macro: true, label: m.label, tone: m.tone, shade: 1, g: `${fmt(m.g)} ${pmText(m.n)}`, kcal: `${fmt(m.kcal, 0)} ${pmText(m.kcalN, 0)}`, pct: pct(m.kcal) },
      ...(m.slices.length > 1 ? m.slices.map((s) => ({ macro: false, label: s.label, tone: s.tone, shade: s.shade, g: fmt(s.g), kcal: fmt(s.kcal, 0), pct: pct(s.kcal) })) : []),
    ]),
    note: `From the grams: 9 kcal/g fat, 4 proteins and carbohydrates${macros.some((m) => m.key === 'alcohol') ? ', 7 alcohol' : ''}.`
      + (!registered.estimated ? ` Registered energy: ${fmt(registered.value, 0)} ${pmText(registered, 0)} kcal.` : ''),
  }
}

/** FoodInfo.jsx NutrientTable: value ± interval, range and CV of every known nutrient. */
export function nutrientTable(nutrients) {
  const rows = nutrientRows(nutrients)
  return {
    rows: rows.map(([n, v]) => ({
      label: n.label, missing: !!v.missing, value: `${v.estimated ? '~' : ''}${fmt(v.value)}`, pm: pmText(v), unit: n.unit,
      range: rangeText(v, 1), cv: v.value > 0 ? `CV ${fmt((sdOf(v) / v.value) * 100, 1)}%` : '',
    })),
    missing: rows.some(([, v]) => v.missing),
  }
}

/** screens/ConsumptionInfo.jsx: one consumption, for exactly the amount eaten. `nutrient`: from a breakdown. */
export async function consumptionInfo(id, nutrient) {
  const [log, ctx] = await Promise.all([db.logs.get(id), loadContext()])
  if (!log) return { found: false }
  const item = resolve(ctx, log.itemId)
  const res = consumptionNutrients(ctx, log)
  const [, lo, hi] = span(log.amount, log.amountDelta)
  const list = [{ label: 'Amount eaten', text: amountSpans(log.amount, lo, hi, log.unit, log.amountDelta || 0),
    sub: log.amountText && log.amountText !== String(log.amount) ? `typed as ${amountText(log.amount, log.amountText)}` : null }]
  if (item && !item.components?.length) {
    list.push({ label: 'Entry error', text: [{ t: `${fmt((Number.isFinite(log.entryError) ? log.entryError : DEFAULT_ENTRY_ERROR) * 100, 2)}%` }] })
  }
  if (item) {
    list.push({ label: 'Food', text: [{ t: itemLabel(item) }], tag: madeText(item) || null, more: '· info ›',
      link: `/foods/${item.id}?tab=info${nutrient ? `&nutrient=${nutrient}` : ''}` })
  }
  return {
    found: true,
    title: item ? itemLabel(item) : '(deleted item)',
    subtitle: formatDateTime(log.datetime),
    list,
    macros: macroLine(res.nutrients, res.ok, true),
    failed: !res.ok,
    energy: energyChart(res.nutrients),
    table: nutrientTable(res.nutrients),
  }
}

// --- Temp notes ---------------------------------------------------------------------------------------------
// Pictures go to the app as base64 JPEG (notePicture), once each: it keeps them. Picked ones come from the app as
// addresses it serves (the camera's shot, the gallery's files), are shrunk here as on the web, and wait in `staged`
// until the note is saved.

const staged = new Map() // key -> {blob, name}

/** screens/Notes.jsx: the user's notes, newest first; `have` says whether a picture is on this device yet. */
export async function notes() {
  const user = await getCurrentUser()
  const list = await db.notes.where('[userId+datetime]').between([user.id, Dexie.minKey], [user.id, Dexie.maxKey]).reverse().toArray()
  const have = new Set(await db.files.where('id').anyOf(list.flatMap((n) => n.pictures ?? [])).primaryKeys())
  return {
    user: user.name, userId: user.id,
    keep: `Deleted ${NOTE_DAYS} days after they're made.`,
    rows: list.map((n) => ({
      note: n, when: formatDateTime(n.datetime), title: `Note of ${formatDateTime(n.datetime)}`, done: !!n.done, left: leftText(n), text: n.text ?? '',
      pics: (n.pictures ?? []).map((id) => ({ id, name: n.pictureNames?.[id] ?? null, have: have.has(id) })),
    })),
  }
}

/** Pictures picked in the app: [{url, name}] -> [{key, name}], shrunk and waiting for the note's save. */
export async function notePick(files) {
  const out = []
  for (const f of files) {
    const blob = await (await fetch(f.url)).blob()
    const key = makeId()
    staged.set(key, { blob: await shrink(Object.assign(blob, { name: f.name })), name: f.name || undefined })
    out.push({ key, name: f.name || null })
  }
  return out
}

/** A picture (stored, or picked and not saved yet) as base64 JPEG; null if it isn't on this device yet. */
export async function notePicture(id) {
  const blob = staged.get(id)?.blob ?? (await db.files.get(id))?.blob
  if (!blob) return null
  const url = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
  return url.slice(url.indexOf(',') + 1)
}

/** Saves a note: `pics` [{id, name}] stored or [{key, name}] picked. {alert} if there's nothing in it. */
export async function saveNote(note, text, done, pics) {
  if (!text.trim() && !pics.length) return { alert: 'Write something or add a picture.' }
  await putNote(note, text, done, pics.map((p) => (p.key ? { key: p.key, blob: staged.get(p.key)?.blob, name: p.name ?? undefined } : { id: p.id, name: p.name ?? undefined })))
  for (const p of pics) if (p.key) staged.delete(p.key)
  return { done: true }
}

export const deleteNote = async (note) => dropNote(note)

// --- Foods --------------------------------------------------------------------------------------------------

/** screens/Foods.jsx FoodList, for what's typed in its search box. */
export async function foods(query = '') {
  const ctx = await loadContext()
  const conflicts = conflictingFoods(ctx.list)
  return {
    rows: foodListMatches(ctx, query).map(([r, label]) => {
      const [amt, unit] = baseAmount(r)
      const n = nutrientsFor(ctx, r.id, amt, unit)
      return {
        id: r.id, label, recipe: kindOf(r) === 'recipe', made: madeText(r) || null, conflict: conflicts.has(r.id),
        per: `per ${r.amount > 0 ? amountText(amt, r.amountText) : amt}${r.amountDeltaAuto === false && r.amountDelta > 0 ? ` ±${r.amountDelta}` : ''} ${unit}`,
        macros: macroLine(n.nutrients, n.ok),
      }
    }),
  }
}

const foodEvents = {
  component: (st, [i, id]) => ff.pickComponent(st, i, id),
  auto: (st) => ff.autoAmount(st),
  addUnit: (st) => ({ ...st.form, units: [...st.form.units, ff.newUnit(st.form)] }),
  removeUnit: (st, i) => ({ ...st.form, units: st.form.units.filter((_, j) => j !== i) }),
  addComponent: (st) => ({ ...st.form, components: [...st.form.components, ff.newComponent()] }),
  removeComponent: (st, i) => ({ ...st.form, components: st.form.components.filter((_, j) => j !== i) }),
  // Optional nutrients only: the value cleared, so it's stored as NaN again (the app hides the row).
  removeNutrient: (st, key) => ({ ...st.form, nutrients: { ...st.form.nutrients, [key]: { text: '' } } }),
  // Back from a new component made with "+": it's set as that component.
  created: (st, [i, id]) => ff.withCreated(st.ctx, st.form, i, id),
  unlink: (st) => ({ ...st.form, source: null }),
}

async function foodFor(args) {
  const config = await getConfig()
  const [ctx, logs] = await Promise.all([ctxNow(), logsNow()])
  const id = args.id
  const isNew = id === 'new'
  const rec = isNew ? null : /^(ciqual|fdc):/.test(id) ? ctx.items.get(id) ?? null : await db.items.get(id)
  if (!isNew && !rec) return { missing: true }
  const initial = rec?.readOnly ? null : rec
  let form = args.form
  if (!form) {
    // A new food may come prefilled from "Search external" (external.js's draft); a read-only (CIQUAL, USDA) food
    // prefills a new one: saving makes the copy.
    const prefill = isNew ? peekPendingDraft() : rec?.readOnly ? rec : null
    if (isNew && prefill) clearPendingDraft()
    form = ff.initialForm(initial ?? prefill, initial, args.name ?? undefined)
  }
  let st = ff.editorState(ctx, logs, form, initial, config.dayStart)
  if (args.event) st = ff.editorState(ctx, logs, foodEvents[args.event[0]](st, args.event[1]), initial, config.dayStart)
  return { st, rec, initial, copy: !!rec?.readOnly }
}

/**
 * The food editor (Foods.jsx FoodEditor and FoodForm). `args`: `id` (a food's, or "new"), `name` (a new one's),
 * then `form` as this returned it and typed since, `extraShown` (nutrients added and still empty), maybe an `event`
 * ([name, arg] of foodEvents). Returns the form and what to show.
 */
export async function foodEditor(args) {
  const { st, rec, initial, copy, missing } = await foodFor(args)
  if (missing) return { form: null, view: { missing: true } }
  const { form, ctx } = st
  const extraShown = args.extraShown ?? []
  const { shown, hidden } = ff.nutrientRowsShown(form, extraShown)
  const src = sourceLabel(form.source)
  const label = (id) => {
    const it = id != null ? resolve(ctx, id) : null
    return it ? foodLabel(it) : null
  }
  return {
    form,
    view: {
      missing: false,
      isNew: !initial && !copy,
      title: args.id === 'new' ? 'New food' : rec.name || 'Food',
      copyNote: copy ? `A ${rec.source?.db === 'fdc' ? 'USDA' : 'CIQUAL'} food, read-only: saving makes it a food of your own.` : null,
      external: !initial && !copy ? `/foods/external${form.name.trim() ? `?q=${encodeURIComponent(form.name.trim())}` : ''}` : null,
      source: src ? { text: src.text, href: src.href } : null,
      units: form.units.map((u) => ({ fromPlaceholder: deltaPlaceholder(u.fromAmount, u.fromUnit), toPlaceholder: deltaPlaceholder(u.toAmount, u.toUnit) })),
      expiryPlaceholder: String(DEFAULT_EXPIRY_DAYS),
      components: form.components.map((c, i) => ({
        item: label(c.itemId),
        units: ff.componentUnits(ctx, c),
        deltaPlaceholder: deltaPlaceholder(c.amount, c.unit),
        entryError: fmt((c.entryError ?? DEFAULT_ENTRY_ERROR) * 100, 2),
        macros: st.componentNutrients[i] ? macroLine(st.componentNutrients[i].nutrients, st.componentNutrients[i].ok, true) : null,
      })),
      deltaPlaceholder: deltaPlaceholder(form.amount, form.unit),
      hasComponents: st.hasComponents,
      auto: !st.hasComponents ? null : st.total.problem ? { problem: `Can't add up the components: ${st.total.problem}` }
        : { text: `sum of components: ${ff.round(st.total.value, 6)} ± ${ff.round(st.total.delta, 3)} ${st.totalUnit}` },
      previewLabel: `Per ${st.amt} ${st.unit}: `,
      preview: macroLine(st.preview.nutrients, st.preview.ok, true),
      nutrients: shown.map((n) => ({ key: n.key, label: n.label, unit: n.unit, placeholder: n.default === 0 ? '0' : 'NaN', core: ff.CORE.includes(n.key) })),
      adder: hidden.map((n) => ({ key: n.key, label: n.label, unit: n.unit })),
      category: ff.CATEGORY_OPTIONS.find((o) => o.value === form.category)?.label ?? 'Unknown',
      sameId: initial ? ff.sameIdAs(ctx, initial) : null,
      canDelete: !!initial,
      search: { oldBefore: st.oldBefore, at: form.isMade ? form.madeAt : null, skipItem: initial?.id ?? null, exclude: initial?.id ?? null },
    },
  }
}

/** The category dropdown's options: [{value, label, group}]. */
export const categoryOptions = () => ff.CATEGORY_OPTIONS

/** Saves the food editor's form: {alert}, or {done, id}. */
export async function saveFood(args) {
  const { st, initial } = await foodFor(args)
  const problem = ff.saveProblem(st.form)
  if (problem) return { alert: problem }
  return { done: true, id: await ff.save(st.ctx, st.form, initial) }
}

export const deleteFood = (id) => db.items.delete(id)

/** screens/FoodInfo.jsx, the Info tab: the nutrients for `per` `perUnit` (null: the food's own amount). */
export async function foodInfo(id, per = null, perUnit = null, nutrient = null) {
  const ctx = await loadContext()
  const item = /^(ciqual|fdc):/.test(id) ? ctx.items.get(id) : await db.items.get(id)
  if (!item) return { missing: true }
  const [baseAmt, baseUnit, baseDelta] = baseAmount(item)
  const units = unitsFor(ctx, item.id)
  const perText = per ?? String(baseAmt)
  const unit = perUnit ?? units[0] ?? baseUnit
  const amount = Number(normalizeNumber(perText))
  const res = amount > 0 ? nutrientsFor(ctx, item.id, amount, unit, 0) : null
  const lead = ROWS.find((r) => r.key === nutrient) ?? NUTRIENTS.find((n) => n.key === nutrient)
  const components = (item.components ?? []).map((c, i) => {
    const sub = nutrientsFor(ctx, c.itemId, c.amount, c.unit, c.amountDelta)
    const v = lead && (lead.key === 'energy' ? calories(sub.nutrients) : sub.nutrients[lead.key])
    return { c, i, sub, v: sub.ok && v && Number.isFinite(v.value) ? v : null }
  })
  if (lead) components.sort((a, b) => (b.v?.value ?? -Infinity) - (a.v?.value ?? -Infinity))
  const list = []
  if (!item.components?.length) list.push({ label: 'Category', text: [{ t: categoryName(item.category) }] })
  const [, blo, bhi] = span(baseAmt, baseDelta)
  list.push({ label: 'Nutrients are per', text: amountSpans(baseAmt, blo, bhi, baseUnit, baseDelta) })
  for (const u of item.units ?? []) {
    const [f, lo, hi] = unitFactorSpan(u.fromUnit, u.toUnit, [u])
    list.push({
      label: !(u.fromAmount === 1 && !(u.fromDelta > 0))
        ? `${fmt(u.fromAmount, 2)}${u.fromDelta > 0 ? ` ±${fmt(u.fromDelta, 2)}` : ''} ${u.fromUnit} = ${fmt(u.toAmount, 2)}${u.toDelta > 0 ? ` ±${fmt(u.toDelta, 2)}` : ''} ${u.toUnit}` : null,
      text: [{ t: `1 ${u.fromUnit} = ` }, ...amountSpans(f, lo, hi, u.toUnit)],
    })
  }
  if (lead && components.length) list.push({ note: true, text: [{ t: `Components by ${lead.label.toLowerCase()}, largest first` }] })
  for (const { c, sub, v } of components) {
    const kcal = calories(sub.nutrients)
    const [, lo, hi] = span(c.amount, c.amountDelta)
    const child = resolve(ctx, c.itemId)
    list.push({
      label: child ? itemLabel(child) : '(missing item)', tag: madeText(child) || null,
      text: [...amountSpans(c.amount, lo, hi, c.unit, c.amountDelta || 0), { t: ` → ${sub.ok ? `${fmt(kcal.value, 0)} ${pmText(kcal, 0)} kcal` : "can't compute"}`, m: true }],
      lead: !lead ? null : v ? [{ t: `${v.estimated ? '~' : ''}${fmt(v.value)}`, b: true }, { t: ` ${pmText(v)} ${lead.unit}`, m: true, small: true }] : [{ t: '–', b: true }, { t: ` ${lead.unit}`, m: true, small: true }],
    })
  }
  return {
    missing: false, per: perText, unit, units,
    energy: res?.ok ? energyChart(res.nutrients) : null,
    about: `Taken as exact; each range holds ${fmt(getCoverage() * 100)}% of the probability. It includes how much a sample of${item.components?.length ? ' each component' : ' this food'} varies (by category), how far the entry may be from what's eaten (${fmt(DEFAULT_ENTRY_ERROR * 100)}%, set per consumption), the digits of its values and the error of every amount (under Amounts).`,
    failed: !!res && !res.ok,
    table: res ? nutrientTable(res.nutrients) : null,
    list,
  }
}

// --- Targets ------------------------------------------------------------------------------------------------

/** screens/Targets.jsx: the user's targets, latest first. */
export async function targets() {
  const user = await getCurrentUser()
  const list = await db.targets.where('userId').equals(user.id).reverse().sortBy('validFrom')
  const now = new Date().toISOString()
  const activeId = list.find((t) => t.validFrom <= now)?.id
  return {
    user: user.name,
    new: forms.newTarget(user.id, list[0]),
    rows: list.map((t, i) => ({
      target: t,
      from: `From ${formatDateTime(t.validFrom)}`,
      tag: t.id === activeId ? 'active' : t.validFrom > now ? 'upcoming' : null,
      until: i > 0 ? `until ${formatDateTime(list[i - 1].validFrom)}` : null,
      values: forms.targetText(t),
    })),
  }
}

/** The target editor's start: its time as typed, its rows, and every nutrient (in order) for "+ add nutrient". */
export const targetEditor = (target) => ({
  title: target.id ? 'Edit target' : 'New target',
  validFrom: toLocalInput(new Date(target.validFrom)),
  rows: forms.targetRows(target),
  nutrients: NUTRIENTS.map((n) => ({ key: n.key, label: n.label, unit: n.unit })),
})

export const saveTarget = async (target, validFrom, rows) => (await forms.saveTarget(target, validFrom, rows)) ?? { done: true }
export const deleteTarget = (id) => db.targets.delete(id)

// --- Body measurements --------------------------------------------------------------------------------------

/** screens/Body.jsx on today: the 7-day averages, maintenance, the entries. */
export async function body() {
  const config = await getConfig()
  const { user, rows, known, weeks, maint } = await forms.loadBody(today(config.dayStart))
  return {
    user: user.name, userId: user.id,
    weeks: weeks.map((m) => ({ label: m.label, value: m.week ? fmt(m.week.value, 1) : null, unit: m.unit, pm: m.week?.v > 0 ? pmText(m.week) : null })),
    maint: forms.maintenanceText(maint),
    rows: rows.map((r) => ({ entry: r, text: forms.entryText(r), when: formatDateTime(r.datetime) })),
    known,
    // A new entry's fields show the last value of each as a hint.
    fields: BUILTIN_FIELDS.map((f) => ({ key: f.key, label: f.label, unit: f.unit, hint: f.hint ?? null, last: rows.find((r) => r.values?.[f.key])?.values[f.key].text ?? null })),
  }
}

export const bodyEditor = (entry) => ({
  title: entry.id ? 'Edit measurements' : 'New measurements', datetime: toLocalInput(new Date(entry.datetime)), ...forms.entryForm(entry),
})

/** Names used before for what's typed (Body.jsx NameCombo): [{label, unit, near}], `near` for a "did you mean". */
export function bodyNames(text, known) {
  const matches = nameMatches(text, known).filter((n) => n.key !== nameKey(text) || n.label !== text.trim())
  const near = nameKey(text) && !known.some((n) => n.key === nameKey(text)) ? lookalike(text, known) : null
  return matches.map((n) => ({ label: n.label, unit: n.unit ?? '', near: near?.key === n.key }))
}

/** "± Δ" placeholders of a measurement form's values (no unit: from the digits). */
export const deltaPlaceholders = (amounts) => amounts.map((a) => deltaPlaceholder(a))

export const saveBody = async (entry, form, known, answers) => (await forms.saveEntry(entry, form, known, answers)) ?? { done: true }
export const deleteBody = (id) => db.weights.delete(id)

// --- Users --------------------------------------------------------------------------------------------------

export async function users() {
  const list = await db.users.orderBy('name').toArray()
  const current = await getCurrentUser()
  const counts = Object.fromEntries(await Promise.all(list.map(async (u) => [u.id, await db.logs.where('userId').equals(u.id).count()])))
  return {
    rows: list.map((u) => ({
      user: u, name: u.name, current: u.id === current?.id, count: `${counts[u.id]} consumption${counts[u.id] === 1 ? '' : 's'}`,
      deleteText: forms.deleteUserText(u, counts[u.id]),
    })),
    canDelete: list.length > 1,
  }
}

export const useUser = (id) => setCurrentUser(id)
export const saveUser = async (user, name) => (await forms.saveUser(user, name, await db.users.toArray())) ?? { done: true }
export const deleteUser = async (id) => (await forms.removeUser(id)) ?? { done: true }

// --- Config -------------------------------------------------------------------------------------------------

export async function config() {
  return {
    form: forms.configForm(await getConfig()),
    placeholders: { coverage: forms.pct(DEFAULT_CONFIG.coverage), capMin: String(DEFAULT_CONFIG.adjCap.min), capMax: String(DEFAULT_CONFIG.adjCap.max) },
    references: forms.REFERENCE_DBS.map(([key, name, about]) => ({ key, name, about })),
  }
}

export const saveConfig = async (form) => (await forms.saveConfigForm(form)) ?? { done: true }

// --- Search external (Open Food Facts) -----------------------------------------------------------------------

let offDrafts = []

/** screens/External.jsx's results for `query`: each product as its row shows it; picked by index (offPick). */
export async function offSearch(query) {
  const q = query.trim()
  offDrafts = (await searchOff(q)).map(offDraft)
  return {
    rows: offDrafts.map((d) => ({ name: d.name, per: `per 100 ${d.unit}`, subtitle: d.subtitle || null, macros: macroLine(d.nutrients) })),
    empty: `Nothing found for "${q}".`,
  }
}

/** The button's label for what's typed: a barcode is looked up. */
export const offButton = (query) => (isBarcode(query) ? 'Look up' : 'Search')

/** Picks result `i`: its full product, waiting for the food editor it goes back to (as External.jsx's pick). */
export async function offPick(i) {
  setPendingDraft(await offProductDraft(offDrafts[i]))
}

// --- Explore ------------------------------------------------------------------------------------------------

const exploreMeta = (nutrient) => ROWS.find((r) => r.key === nutrient) ?? NUTRIENTS.find((n) => n.key === nutrient)
let exploreLast = { ctx: null, nutrient: null, foods: [] }

/** Every food ranked for `nutrient` (explore.js), worked out again only when the foods change. */
async function exploreAll(nutrient) {
  const ctx = await ctxNow()
  if (exploreLast.ctx !== ctx || exploreLast.nutrient !== nutrient) {
    exploreLast = { ctx, nutrient, foods: exploreFoods(ctx, nutrient, exploreMeta(nutrient)) }
  }
  return exploreLast.foods
}

/** The foods listed: databases in `off` left out; with `loggedOnly`, only foods any user has logged. */
async function exploreShown(nutrient, off, loggedOnly) {
  const foods = await exploreAll(nutrient)
  const logged = loggedOnly ? new Set((await logsNow()).map((l) => l.itemId)) : null
  return { foods, shown: foods.filter((f) => !off.includes(f.db) && (!logged || logged.has(f.item.id))) }
}

/** screens/Explore.jsx's list and switches; `off`: the databases switched off. */
export async function explore(nutrient, off = [], loggedOnly = false) {
  const meta = exploreMeta(nutrient)
  if (!meta) return { title: 'Explore', unknown: true, dbs: [], rows: [], empty: 'Unknown nutrient.' }
  const { foods, shown } = await exploreShown(nutrient, off, loggedOnly)
  return {
    title: meta.label,
    unknown: false,
    dbs: exploreDbs(foods).map((d) => ({ name: d, on: !off.includes(d) })),
    rows: shown.map((f) => ({
      id: String(f.item.id), label: itemLabel(f.item), value: fmt(f.n.value, 1), pm: `${pmText(f.n)} ${meta.unit}`,
      text: `${f.text} · per ${fmt(f.per[0], 2)} ${f.per[1]}`,
    })),
    empty: `No food with ${meta.label.toLowerCase()} here.`,
  }
}

/** The search box: the index of the best-ranked listed food matching `query`, -1 if none (or nothing typed). */
export async function exploreFind(nutrient, off, loggedOnly, query) {
  const q = fold(query.trim())
  if (!q) return -1
  return (await exploreShown(nutrient, off, loggedOnly)).shown.findIndex((f) => searchText(f.item).includes(q))
}

/** The picked food on top: its name (a link to its info), per what, and its energy chart. */
export async function explorePicked(nutrient, id) {
  const f = (await exploreAll(nutrient)).find((x) => String(x.item.id) === id)
  if (!f) return null
  return {
    label: itemLabel(f.item), per: ` · per ${fmt(f.per[0], 2)} ${f.per[1]}`,
    link: `/foods/${f.item.id}?tab=info&nutrient=${nutrient}`, chart: energyChart(f.nutrients),
  }
}

// --- Breakdown ----------------------------------------------------------------------------------------------

/**
 * screens/Breakdown.jsx: one nutrient over `query`'s window (`from`, `to`; `win`, `per`), every row ready to lay
 * out. Bars: the low end, high end and value as fractions of the bar.
 */
export async function breakdown(nutrient, query = {}) {
  const { from, to, win, per } = query
  const meta = bd.breakdownMeta(nutrient)
  const when = from === to ? prettyDay(from) : `${from} → ${to}`
  if (!meta?.label) return { unknown: true, title: 'Breakdown', subtitle: when }
  const byDay = win === 'last7' && from !== to
  const perKcal = per === 'kcal' && nutrient !== 'energy'
  const data = await bd.loadBreakdown(nutrient, from, to)
  const st = bd.breakdownState(data, perKcal)
  const { dg } = st
  const unit = perKcal ? `${meta.unit}/100 kcal` : meta.unit
  const value = (r) => ({
    value: `${r.estimated ? '~' : ''}${fmt(r.value, dg)}`,
    more: ` ${pmText(r.n)} · ${perKcal ? `${fmt(r.e.value, 0)} kcal` : `${st.total ? fmt((r.value / st.total) * 100, 0) : 0}%`}`,
  })
  const bar = (r, scale) => {
    const [lo, hi] = bounds(r.n)
    const at = (x) => Math.max(0, Math.min(1, x / scale))
    return { lo: at(lo), hi: at(hi), mean: at(r.value), err: hi > lo }
  }
  const time = (datetime) => (from === to ? toLocalInput(new Date(datetime)).slice(11) : formatDateTime(datetime))
  const label = (item) => (item ? itemLabel(item) : '(deleted item)')
  const made = (item) => madeText(item) || null
  const amount = (c) => `${amountText(c.amount, c.amountText)} ${c.unit}`
  const link = (r) => `/consumptions/${r.c.id}?nutrient=${nutrient}`
  const entry = (e) => {
    if (e.groupId == null) {
      const r = e.members[0]
      return {
        key: e.key, group: false, label: label(r.item), made: made(r.item), ...value(r), bar: bar(r, st.scale),
        sub: `${time(r.c.datetime)} · ${amount(r.c)} · range ${rangeText(r.n, dg)} ${unit}`, link: link(r), members: [],
      }
    }
    const names = [...new Set(e.members.map((r) => label(r.item)))].join(' + ')
    const times = e.members.map((r) => r.c.datetime).sort()
    return {
      key: e.key, group: true, groupId: e.groupId, name: e.name, label: e.name || names, made: null, ...value(e), bar: bar(e, st.scale),
      sub: `${e.name ? names : `Group of ${e.members.length}`} · ${time(times[0])}${times.length > 1 && times[0] !== times.at(-1) ? `–${time(times.at(-1))}` : ''} · range ${rangeText(e.n, dg)} ${unit}`,
      members: e.members.map((r) => ({ label: label(r.item), made: made(r.item), ...value(r), sub: `${time(r.c.datetime)} · ${amount(r.c)}`, link: link(r) })),
    }
  }
  const route = (kcal) => `/breakdown/${nutrient}?${new URLSearchParams({ from, to, ...(win && { win }), ...(kcal && { per: 'kcal' }) })}`
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
  return {
    unknown: false,
    title: meta.label, subtitle: when, cls: meta.cls,
    total: { value: fmt(st.shown.value, dg), unit, pm: pmText(st.shown), range: `· range ${rangeText(st.shown, dg)} ${unit}` },
    per: nutrient === 'energy' ? null : { kcal: perKcal, total: route(false), perKcal: route(true) },
    views: [...(byDay ? [['days', 'Days']] : []), ['ranked', 'Ranked'], ...(perKcal ? [] : [['quintiles', 'Quintiles']])].map(([key, l]) => ({ key, label: l })),
    view: byDay ? 'days' : 'ranked',
    empty: st.rows.length ? null : `No consumption with ${meta.label.toLowerCase()} in this period.`,
    rows: st.rows.map(entry),
    days: st.dayRows.map((d) => ({
      key: d.day, group: false, label: prettyDay(d.day), made: null, ...value(d), bar: bar(d, st.dayScale), members: [],
      sub: d.count ? `${plural(d.count, 'consumption', 'consumptions')} · range ${rangeText(d.n, dg)} ${unit}` : `No consumption with ${meta.label.toLowerCase()}`,
      link: `/breakdown/${nutrient}?from=${d.day}&to=${d.day}${perKcal ? '&per=kcal' : ''}`,
    })),
    quintiles: perKcal ? [] : bd.quintiles(st.rows, st.total).map((g) => {
      const v = bd.sum(g.rows, 'value')
      return {
        name: g.name, keys: g.rows.map((r) => r.key),
        info: ` · ${fmt(v, 0)} ${meta.unit} (${st.total ? fmt((v / st.total) * 100, 0) : 0}%) · ${plural(g.rows.length, 'entry', 'entries')}`,
      }
    }),
    notes: [
      ...(st.noKcal > 0 ? [`${st.noKcal} without calories left out.`] : []),
      ...(data.missing > 0 ? [`${plural(data.missing, 'consumption', 'consumptions')} without ${meta.label.toLowerCase()}.`] : []),
    ].join(' ') || null,
    failed: data.failed > 0 ? `${data.failed} couldn't be computed.` : null,
    explore: `/explore/${nutrient}`,
  }
}

/** Groups the ticked entries (`keys`) of the breakdown shown (`query` as breakdown's); `name` may be blank. */
export async function breakdownGroup(nutrient, query, keys, name) {
  const data = await bd.loadBreakdown(nutrient, query.from, query.to)
  const { rows } = bd.breakdownState(data, query.per === 'kcal' && nutrient !== 'energy')
  await bd.makeGroup(data.userId, rows.filter((e) => keys.includes(e.key)), name)
}

export const renameGroup = async (groupId, name) => bd.renameGroup((await getCurrentUser()).id, groupId, name)
export const ungroup = async (groupId) => bd.ungroup((await getCurrentUser()).id, groupId)

// --- Time graphs --------------------------------------------------------------------------------------------

let graphsLast = null // the data of the graphs shown last: {key, data}, for their readouts

/** The day graphs end on and how many days, from the route's query (`days`, `end`), as Graphs.jsx. */
async function graphsWindow(query) {
  const day = today((await getConfig()).dayStart)
  return { day, span: gr.spanOf(query.days), last: query.end && query.end < day ? query.end : day }
}

/**
 * screens/Graphs.jsx: a chart per dashboard row (body measurements after calories), each as columns in % of its
 * height (target regions, fill pieces, the estimate; a measure's dot and whisker), gridlines and the 7-day
 * average's points.
 */
export async function graphs(query = {}) {
  const { day, span, last } = await graphsWindow(query)
  const data = await gr.loadGraphs(last, span)
  graphsLast = { key: `${last} ${span}`, data }
  const { list } = data
  const n = list.length
  const empty = { zones: [], pieces: [], mean: null, dot: null }
  const chart = (kind, key, label, unit, cls, sc, column) => ({
    kind, key, label, unit, cls,
    grid: sc.grid.map((t) => ({ at: sc.pos(t), text: fmt(t, sc.digits) })),
    columns: list.map(column),
    week: gr.weekPoints(list, sc.avgOf, sc.pos),
  })
  const nutrient = (row) => {
    const sc = gr.nutrientScale(row, data)
    return chart('nutrient', row.key, row.label, row.unit, row.cls, sc, (d) => {
      const { target, bar } = gr.columnBars(sc.valueOf(d), data.targets[d][row.key], sc.pos)
      const minAt = target?.minAt
      const maxAt = target?.maxAt
      return {
        zones: target ? [
          ...(minAt != null ? [{ from: 0, to: minAt, region: 'under' }] : []),
          { from: minAt ?? 0, to: maxAt ?? 100, region: 'ok' },
          ...(maxAt != null ? [{ from: maxAt, to: 100, region: 'over' }] : []),
        ] : [],
        pieces: bar ? fillPieces(bar).map((pc) => ({ from: pc.from, to: pc.to, region: pc.region, hatched: !!pc.hatched })) : [],
        mean: bar && hasMean(bar) ? bar.fill : null,
        dot: null,
      }
    })
  }
  const measure = (m) => {
    const sc = gr.measureScale(m, list)
    return chart('measure', m.key, m.label, m.unit, '', sc, (d) => {
      const v = m.daily[d]
      if (!v) return empty
      const [lo, hi] = bounds(v)
      return { ...empty, dot: { at: sc.pos(v.value), lo: hi > lo ? sc.pos(lo) : null, hi: hi > lo ? sc.pos(hi) : null } }
    })
  }
  return {
    subtitle: `${list[0]} → ${list.at(-1)} · daily`,
    span, last, today: day, defaultDays: gr.DEFAULT_DAYS, maxSlider: gr.MAX_SLIDER, maxDays: gr.MAX_DAYS,
    list,
    xLabels: [...new Set([0, Math.floor((n - 1) / 2), n - 1])].map((i) => ({ at: (i + 0.5) / n, text: list[i].slice(5) })),
    charts: data.rows.flatMap((r) => [nutrient(r), ...(r.key === 'energy' ? data.measures.map(measure) : [])]),
  }
}

/** Under each chart, `day` spelled out: its value and the 7-day average's (rich spans), and where tapping goes. */
export async function graphsReadout(query, day) {
  const { span, last } = await graphsWindow(query)
  const data = graphsLast?.key === `${last} ${span}` ? graphsLast.data : await gr.loadGraphs(last, span)
  const pm = (x, digits, rangeDigits) => (x.v > 0 ? [{ t: ` ${pmText(x, digits)}` }, { t: ` (${rangeText(x, rangeDigits)})`, c: 'range', small: true }] : [])
  const head = { t: `${prettyDay(day)} · `, m: true }
  const avgHead = { t: '7-day average · ', m: true }
  const out = {}
  for (const row of data.rows) {
    const sc = gr.nutrientScale(row, data)
    const v = sc.valueOf(day)
    const avg = sc.avgOf(day)
    const range = data.targets[day]?.[row.key]
    const bar = v && targetBar(v, range, sc.pos)
    const value = (x, cls) => [{ t: `${x.estimated ? '~' : ''}${fmt(x.value, 0)}`, b: true, c: cls }, { t: ` ${row.unit} ${pmText(x)}` },
      ...(sdOf(x) > 0 ? [{ t: ` (${rangeText(x)})`, c: 'range', small: true }] : [])]
    out[row.key] = {
      line1: [head, ...(v ? value(v, row.cls || null) : [{ t: 'no consumptions', m: true }]),
        ...(range && (Number.isFinite(range.min) || Number.isFinite(range.max))
          ? [{ t: ` · ${rangeLabel(range)} ${bar ? statusMark(bar.status) : ''}`, c: bar ? ({ ok: 'kcal', under: 'prot', over: 'prot' })[bar.status] ?? null : null }] : [])],
      line2: [avgHead, ...(avg ? value(avg, 'accent') : [{ t: 'no consumptions', m: true }])],
      link: v ? `/breakdown/${row.key}?from=${day}&to=${day}&win=daily` : null,
    }
  }
  for (const m of data.measures) {
    const x = m.daily[day]
    const avg = m.week[day]
    const value = (y, c) => [{ t: fmt(y.value, 2), b: true, c }, { t: ` ${m.unit}` }, ...pm(y, 2, 1)]
    out[m.key] = {
      line1: [head, ...(x ? value(x, null) : [{ t: 'not measured', m: true }])],
      line2: [avgHead, ...(avg ? value(avg, 'accent') : [{ t: 'none', m: true }])],
      link: null,
    }
  }
  return out
}

// --- Backup -------------------------------------------------------------------------------------------------

/** An action of the Backup screen: {} when done, {alert} when it failed (409: another device synced first, quiet). */
async function backupAct(f) {
  try {
    return (await f()) ?? {}
  } catch (e) {
    return e.status === 409 ? {} : { alert: e.message }
  }
}

/** screens/Backup.jsx: off, or the status line, the inbox note, the conflicts' count. The secret only when asked. */
export function backup() {
  const s = getState()
  if (!s) return { on: false }
  return {
    on: true,
    status: statusText(s), synced: status(s) === 'synced',
    inbox: s.inbox ? `Took in ${plural(s.inbox.entries, 'consumption')} from the inbox ${formatDateTime(s.inbox.at)}.` : null,
    conflicts: s.conflicts ?? 0,
    conflictLabel: conflictLabelShown(),
  }
}

/** The rows changed differently here and on another device, as Backup.jsx Conflicts lists them. */
export async function backupConflicts() {
  const [list, ctx] = await Promise.all([bk.getConflicts(), ctxNow()])
  return list.map((c) => ({
    title: TABLE_NAMES[c.t], label: rowLabel(c.t, c.local ?? c.cloud, ctx),
    fields: c.local && c.cloud ? differingFields(c.local, c.cloud).map((f) => ({ name: f, here: shownValue(c.local[f]), there: shownValue(c.cloud[f]) })) : [],
    note: c.local && c.cloud ? null : c.local ? 'Deleted on the other device, changed here.' : 'Deleted here, changed on the other device.',
  }))
}

/** The secret, its link and the link's QR code (rows of "1" dark, "0" light; the quiet zone left to the drawing). */
export function backupSecret() {
  const s = getState()
  if (!s) return null
  const link = bk.backupLink(s.secret)
  const qr = qrcode(0, 'M')
  qr.addData(link)
  qr.make()
  const n = qr.getModuleCount()
  const rows = []
  for (let r = 0; r < n; r++) {
    let row = ''
    for (let c = 0; c < n; c++) row += qr.isDark(r, c) ? '1' : '0'
    rows.push(row)
  }
  return { secret: s.secret, link, qr: rows }
}

export const backupStart = (invite) => backupAct(() => bk.start(invite))
export const backupSync = () => backupAct(() => bk.sync())
export const backupChangeSecret = () => backupAct(() => bk.changeSecret())
export const backupForget = () => backupAct(() => bk.forget())
export const backupResolve = (i, side) => backupAct(() => bk.resolveConflict(i, side))
export const backupConflictLabel = (on) => bk.showConflictLabel(on)

let fetched = null // the backup fetched to restore, until confirmed: {secret, backup}

/**
 * Restoring, step one: the secret pasted or this device's (`text` null), checked, and its backup fetched. Asks back
 * {confirm} (with {switching} first if the device is on another secret), or {alert}.
 */
export const backupFetch = (text) => backupAct(async () => {
  const secret = text == null ? getState()?.secret : bk.parseSecret(text)
  if (!secret) throw new Error("That isn't a backup secret or link.")
  const s = getState()
  fetched = { secret, backup: await bk.fetchBackup(secret) }
  return {
    switching: !!(s && secret !== s.secret),
    confirm: `Restoring REPLACES all data on this device with the backup from ${formatDateTime(fetched.backup.updated)}; `
      + "changes here that haven't synced are lost. Continue?",
  }
})

/** Restoring, step two: the backup fetched replaces this device's data. */
export const backupRestore = () => backupAct(async () => {
  if (!fetched) throw new Error('Nothing fetched to restore.')
  const { secret, backup: b } = fetched
  fetched = null
  await bk.restore(secret, b)
  return { done: 'Restored.' }
})
