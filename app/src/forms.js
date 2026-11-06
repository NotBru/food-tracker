// The smaller editors' logic (screens Targets, Body, Users and Config, and the Android app's native ones through
// native/core.js): checking and saving what was typed. Each save returns {alert} when it can't, else saves.
import Dexie from 'dexie'
import { DEFAULT_CONFIG, db, deleteUser, getConfig, getCurrentUser, saveConfig, setCurrentUser } from './db'
import { consumptionNutrients, loadContext, sumNutrients } from './calc'
import { addDays, dayBounds, logicalDay } from './time'
import { NUTRIENTS, calories, deltaText, fmt, measure, rangeLabel, rangeText } from './nutrients'
import { BUILTIN_FIELDS, KCAL_PER_KG, MAINT_DAYS, MIN_SPAN, MIN_WEIGH_INS, dailyValues, extraNames, fieldValue, lookalike, maintenance, measures, nameKey, weekMean } from './body'

// --- Targets -----------------------------------------------------------------
// design.md: targets are listed latest first; each holds user-chosen nutrients (energy included) and is valid
// from its timestamp until the next target's. Values are daily ranges {min?, max?}; either bound is optional.

export const nutrientByKey = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n]))
// Same order as the nutrient list (energy, proteins, fat, carbs, …).
const rank = (key) => NUTRIENTS.findIndex((n) => n.key === key)
export const inOrder = (entries) => [...entries].sort(([a], [b]) => rank(a) - rank(b))

/** A new target: from now, with the latest target's values. */
export const newTarget = (userId, latest) => ({ validFrom: new Date().toISOString(), userId, values: structuredClone(latest?.values ?? {}) })

/** "Energy 1800–2200 kcal · Proteins ≥ 120 g": a target's values. */
export const targetText = (t) =>
  inOrder(Object.entries(t.values)).map(([k, r]) => `${nutrientByKey[k]?.label ?? k} ${rangeLabel(r)} ${nutrientByKey[k]?.unit ?? ''}`).join(' · ')

/** The target's rows to edit: [key, minText, maxText], in nutrient-list order. */
export function targetRows(target) {
  const txt = (x) => (Number.isFinite(x) ? String(x) : '')
  return NUTRIENTS.filter((n) => n.key in target.values).map((n) => [n.key, txt(target.values[n.key].min), txt(target.values[n.key].max)])
}

/** Saves `target` with `validFrom` (as typed, "YYYY-MM-DDTHH:MM") and `rows`. */
export async function saveTarget(target, validFrom, rows) {
  const num = (t) => (t.trim() !== '' && Number.isFinite(Number(t)) ? Number(t) : undefined)
  const values = {}
  for (const [k, minT, maxT] of rows) {
    const min = num(minT)
    const max = num(maxT)
    if (min === undefined && max === undefined) continue
    if (min !== undefined && max !== undefined && min > max) return { alert: `${nutrientByKey[k]?.label ?? k}: min is above max.` }
    values[k] = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) }
  }
  if (!Object.keys(values).length) return { alert: 'Set at least one min or max.' }
  const rec = { validFrom: new Date(validFrom).toISOString(), userId: target.userId, values }
  if (target.id) await db.targets.update(target.id, rec)
  else await db.targets.add(rec)
  return null
}

// --- Body measurements ----------------------------------------------------------

/** "78.1 kg · 18.5% fat · 84 cm waist · Neck 38 cm": what one entry holds, each value as typed. */
export function entryText(entry) {
  const pm = (m) => (m.auto ? '' : ` ±${m.delta}`)
  return [
    ...BUILTIN_FIELDS.filter((f) => entry.values?.[f.key]).map((f) => `${entry.values[f.key].text}${pm(entry.values[f.key])} ${f.short}`),
    ...(entry.extra ?? []).map((x) => `${x.label} ${x.text}${pm(x)} ${x.unit ?? ''}`.trim()),
  ].join(' · ')
}

/**
 * The Body screen's data on `day`: the user's entries (newest first), the names of measurements used, each measure's
 * 7-day average, and what weight says about maintenance calories (body.js).
 */
export async function loadBody(day) {
  const config = await getConfig()
  const user = await getCurrentUser()
  const rows = await db.weights.where('[userId+datetime]').between([user.id, Dexie.minKey], [user.id, Dexie.maxKey]).reverse().toArray()
  // Each measure's 7-day average today, for those ever measured.
  const weeks = measures(rows).filter((m) => rows.some((r) => m.of(r)))
    .map((m) => ({ ...m, week: weekMean(dailyValues(rows, m.of, config.dayStart), day) }))
  // Calories per day over the estimate's window.
  const from = dayBounds(addDays(day, -(MAINT_DAYS - 1)), config.dayStart)[0]
  const end = dayBounds(day, config.dayStart)[1]
  const logs = await db.logs.where('[userId+datetime]').between([user.id, from.toISOString()], [user.id, end.toISOString()], true, false).toArray()
  const ctx = await loadContext()
  const byDay = {}
  for (const l of logs) (byDay[logicalDay(l.datetime, config.dayStart)] ??= []).push(consumptionNutrients(ctx, l).nutrients)
  const eaten = Object.fromEntries(Object.entries(byDay).map(([d, ns]) => [d, calories(sumNutrients(ns))]))
  const weight = dailyValues(rows, (e) => fieldValue(e, 'kg'), config.dayStart)
  return { user, rows, known: extraNames(rows), weeks, maint: maintenance(weight, eaten, day) }
}

/** Maintenance kcal (loadBody's `maint`) in words: {need} (what's still missing), or {value, range, detail}. */
export function maintenanceText(maint) {
  if (maint.need) {
    const { weighIns = 0, span = 0, logged } = maint.need
    return {
      need: `Maintenance: needs ${logged === 0 ? 'consumptions logged between the weigh-ins' : `weigh-ins on ${MIN_WEIGH_INS}+ days, at least ${MIN_SPAN} days apart, in the last ${MAINT_DAYS} (so far ${weighIns} over ${span} day${span === 1 ? '' : 's'})`}. Weigh in every morning; it gets sharper with weeks.`,
    }
  }
  const { value, intake, trend, weighIns, from, to, loggedDays, days } = maint
  const perWeek = { ...trend, value: trend.value * 7, v: trend.v * 49 }
  return {
    value: fmt(value.value, 0),
    range: rangeText(value),
    detail: `Logged ${fmt(intake.value, 0)} kcal/day (${loggedDays} of ${days} days logged) and the weight went ${perWeek.value >= 0 ? '+' : '−'}${fmt(Math.abs(perWeek.value), 2)} kg/week ±${fmt(Math.sqrt(perWeek.v), 2)} (${weighIns} weigh-ins, ${from} → ${to}): ${fmt(intake.value, 0)} ${trend.value >= 0 ? '−' : '+'} ${fmt(Math.abs(trend.value) * KCAL_PER_KG, 0)} kcal/day at ${KCAL_PER_KG} kcal per kg.`,
  }
}

/** The entry's texts to edit: {texts: {key: {value, delta}}, extra: [{label, unit, value, delta}]}. */
export function entryForm(entry) {
  return {
    texts: Object.fromEntries(BUILTIN_FIELDS.map((f) => {
      const m = entry.values?.[f.key]
      return [f.key, { value: m?.text ?? '', delta: m ? deltaText(m.delta, m.auto) : '' }]
    })),
    extra: (entry.extra ?? []).map((x) => ({ label: x.label, unit: x.unit ?? '', value: x.text, delta: deltaText(x.delta, x.auto) })),
  }
}

/**
 * Saves `entry` from what was typed. A name that looks like a typo of a `known` one asks first: {ask: {label, near,
 * text}}; `answers` ({label: true to use the known name, false to keep it}) are the replies so far.
 */
export async function saveEntry(entry, { texts, extra, datetime }, known, answers = {}) {
  const num = (t) => t.trim().replace(',', '.')
  const values = {}
  for (const f of BUILTIN_FIELDS) {
    const t = texts[f.key]
    if (!t.value.trim()) continue
    const m = measure(num(t.value), num(t.delta))
    if (!Number.isFinite(m.value)) return { alert: `${f.label}: not a number.` }
    values[f.key] = m
  }
  const out = []
  for (const x of extra) {
    if (!x.label.trim() && !x.value.trim()) continue
    if (!x.label.trim()) return { alert: 'A measurement needs a name.' }
    const m = measure(num(x.value), num(x.delta))
    if (!Number.isFinite(m.value)) return { alert: `${x.label}: not a number.` }
    // A known name keeps its spelling; one that looks like a typo of a known one asks.
    let match = known.find((n) => n.key === nameKey(x.label))
    if (!match) {
      const near = lookalike(x.label, known)
      const label = x.label.trim()
      if (near && !(label in answers)) {
        return { ask: { label, near: near.label, text: `“${label}” looks like “${near.label}”. Use “${near.label}”?\n(Cancel keeps “${label}” as a new measurement.)` } }
      }
      if (near && answers[label]) match = near
    }
    const label = match?.label ?? x.label.trim()
    if (out.some((o) => nameKey(o.label) === nameKey(label))) return { alert: `${label} is in twice.` }
    // A blank unit takes the known measurement's.
    out.push({ label, unit: x.unit.trim() || match?.unit || '', ...m })
  }
  if (!Object.keys(values).length && !out.length) return { alert: 'Type at least one measurement.' }
  const rec = { userId: entry.userId, datetime: new Date(datetime).toISOString(), values, ...(out.length && { extra: out }) }
  await db.weights.put(entry.id ? { ...rec, id: entry.id } : rec)
  return null
}

// --- Users ------------------------------------------------------------------------

/** Saves a user's name (a new user becomes the current one: it's usually added to be used). */
export async function saveUser(user, name, users) {
  const n = name.trim()
  if (!n) return { alert: 'Name is required.' }
  if (users.some((u) => u.id !== user.id && u.name.toLowerCase() === n.toLowerCase())) return { alert: `There is already a user “${n}”.` }
  if (user.id) await db.users.update(user.id, { name: n })
  else await setCurrentUser(await db.users.add({ name: n }))
  return null
}

export async function removeUser(id) {
  try {
    await deleteUser(id)
    return null
  } catch (e) {
    return { alert: e.message }
  }
}

export const deleteUserText = (user, count) =>
  `Deleting ${user.name} also deletes their ${count} consumption${count === 1 ? '' : 's'} and their targets. Foods stay.`

// --- Config -------------------------------------------------------------------------

// Generic-food tables bundled with the app (external.js): [config key, name, what it is].
export const REFERENCE_DBS = [
  ['ciqual', 'CIQUAL', 'ANSES, France: ~3.5k generic foods, English and French names.'],
  ['usda', 'USDA', 'FoodData Central (Foundation Foods, SR Legacy): ~8.1k generic foods, with household measures.'],
]

// Coverage is stored as a share (0.9) and typed as a percentage (90).
export const pct = (p) => String(+(p * 100).toPrecision(4))

/** The config as typed. */
export const configForm = (c) => ({
  dayStart: c.dayStart, dashboard: c.dashboard, coverage: pct(c.coverage), ciqual: c.ciqual, usda: c.usda,
  capMin: String(c.adjCap.min), capMax: String(c.adjCap.max), adjGhost: c.adjGhost, showVersion: c.showVersion, onlyTargets: c.onlyTargets,
  pie: c.pie, pieSquare: c.pieSquare,
})

export async function saveConfigForm(form) {
  const p = Number(form.coverage.trim().replace(',', '.')) / 100
  if (!(p > 0 && p < 1)) return { alert: 'The interval must hold more than 0% and less than 100%.' }
  // A blank cap is the default; 0 turns the correction off for that bound.
  const kcal = (text, def) => (text.trim() === '' ? def : Number(text.trim().replace(',', '.')))
  const adjCap = { min: kcal(form.capMin, DEFAULT_CONFIG.adjCap.min), max: kcal(form.capMax, DEFAULT_CONFIG.adjCap.max) }
  if (!(adjCap.min >= 0 && adjCap.max >= 0)) return { alert: 'The 7-day correction caps must be 0 kcal or more.' }
  await saveConfig({
    dayStart: form.dayStart || DEFAULT_CONFIG.dayStart, dashboard: form.dashboard, coverage: p, ciqual: form.ciqual, usda: form.usda,
    adjCap, adjGhost: form.adjGhost, showVersion: form.showVersion, onlyTargets: !!form.onlyTargets,
    pie: !!form.pie, pieSquare: !!form.pieSquare,
  })
  return null
}
