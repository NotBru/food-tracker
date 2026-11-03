// What the Android app's native screens ask the web app's logic for (through bridge.js). Each view returns what its
// screen shows, as plain JSON: texts already formatted and links as routes, so the Kotlin side only lays it out and
// no logic is copied there. One function per native screen; the web screen it replaces uses the same modules.
import { liveQuery } from 'dexie'
import { DEFAULT_EXPIRY_DAYS, db, exportAll, getConfig, getCurrentUser, importAll, itemLabel, kindOf, madeText } from '../db'
import { amountText, autoAmountDelta, calories, fmt, pmText, rangeLabel, rangeText } from '../nutrients'
import { bounds, sdOf, setCoverage, zero } from '../stats'
import { WINDOWS, WINDOW_NAMES, addDays, dayBounds, daysBetween, formatDateTime, prettyDay, toLocalInput, today, versionStamp } from '../time'
import { energySplit } from '../energy'
import { nutrientRows } from '../screens/FoodInfo'
import { consumptionNutrients, loadContext, resolve, span } from '../calc'
import { DEFAULT_ENTRY_ERROR } from '../errors'
import { foodMatches } from '../search'
import * as cf from '../consumptionForm'
import { barFor, exportFileName, fillEnd, fillPieces, ghostFor, hasMean, loadDashboard, statusMark, windowTitle } from '../dashboard'
import { conflictLabelShown, getState, status } from '../backup'
import { statusText } from '../screens/Backup'

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
    const st = cf.editorState(ctx, logs, { id: opts.skipLog ?? undefined }, { datetime: opts.at, itemId: null, concoction: false, amount: '', amountDelta: '', unit: '', entryError: '' }, (await getConfig()).dayStart)
    show = st.show
  }
  return foodMatches(ctx, query, { exclude: opts.exclude, oldBefore: opts.oldBefore, show }).map(([it]) => foodLabel(it))
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
