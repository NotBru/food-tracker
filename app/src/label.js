import { calories, fmt, isCountUnit, normalizeNumber, NUTRIENTS, pmText } from './nutrients'
import { addScaled, getCoverage, sdOf, zero } from './stats'
import { energySplit } from './energy'
import { baseAmount, consumptionNutrients, nutrientsFor, unitFactorSpan } from './calc'
import { itemLabel, madeText } from './db'
import { formatDateTime } from './time'

// A food's nutrition label as an image: one fixed layout (a package's table, in the app's dark colours), whatever
// the food or the screen: its energy by macro (the Info tab's donut, EnergyChart.jsx), then every nutrient. Values
// and their ± as in the Info tab's table (FoodInfo.jsx), from the same nutrientsFor.

const W = 600 // CSS px; drawn at SCALE for a sharp PNG
const SCALE = 2
const PAD = 24
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif'
// The app's colours (styles.css :root).
const BG = '#111418'
const INK = '#e6edf3'
const SOFT = '#8b949e'
const HAIR = '#2b323c' // row lines
const TONES = { fat: '#d2a8ff', prot: '#ff7b72', carb: '#ffa657', muted: SOFT }

/** A tone at `shade`, mixed with the background (EnergyChart.jsx's colorOf). */
function colorOf({ tone, shade }) {
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  const [a, b] = [hex(TONES[tone]), hex(BG)]
  return `rgb(${a.map((x, i) => Math.round(x * shade + b[i] * (1 - shade))).join(',')})`
}

// Label order (EU and US tables): energy, fat and its kinds, cholesterol, carbs and sugars, fibre, protein, salt,
// sodium, alcohol; a rule; then the rest in the app's order. [key, indent]
const MAIN = [
  ['energy', 0], ['fat', 0], ['saturatedFat', 1], ['monounsaturatedFat', 1], ['polyunsaturatedFat', 1], ['omega3', 2],
  ['transFat', 1], ['cholesterol', 0], ['carbohydrates', 0], ['sugars', 1], ['addedSugars', 2], ['fibers', 0],
  ['proteins', 0], ['salt', 0], ['sodium', 0], ['alcohol', 0],
]
// Shown even when 0 (or unknown: "–"): what every label has.
const ALWAYS = ['energy', 'fat', 'carbohydrates', 'proteins']
const BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n]))

const known = (key, v) => ALWAYS.includes(key) || (v && Number.isFinite(v.value) && (v.value !== 0 || sdOf(v) > 0))

/** The label's rows: { key, label, unit, v, indent, main }. */
function rows(nutrients) {
  const get = (key) => (key === 'energy' ? calories(nutrients) : nutrients[key])
  const main = MAIN.filter(([k]) => known(k, get(k))).map(([key, indent]) => ({ ...BY_KEY[key], v: get(key), indent, main: true }))
  const rest = NUTRIENTS.filter((n) => !MAIN.some(([k]) => k === n.key) && known(n.key, get(n.key)))
    .map((n) => ({ ...n, v: get(n.key), indent: 0, main: false }))
  return [...main, ...rest]
}

/** Splits `text` into lines no wider than `width` (at the context's font). */
function wrap(g, text, width) {
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && g.measureText(next).width > width) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

const valueText = (v) => (v && Number.isFinite(v.value) ? `${v.estimated ? '~' : ''}${fmt(v.value)}` : '–')
const deltaText = (v) => (v && Number.isFinite(v.value) && sdOf(v) > 0 ? pmText(v) : '')

/**
 * Draws the label onto a new canvas. `title`: the food's label; `made`: its made-at text (concoctions); `per`: e.g.
 * "150 g"; `perNote`: e.g. "≈ 75 ±5 g" or "eaten 2026-11-05 13:00"; `nutrients`: from nutrientsFor.
 */
export function drawLabel({ title, made, per, perNote, nutrients, ok = true }) {
  const list = rows(nutrients)
  const missing = list.some((r) => r.v?.missing)
  const estimated = list.some((r) => r.v?.estimated)
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = `600 20px ${FONT}`
  const titleLines = wrap(measure, title, W - 2 * PAD)
  const notes = [
    `± holds ${fmt(getCoverage() * 100)}% of the probability.`,
    estimated && '~ estimated from the macros (4/9/4 kcal/g, alcohol 7).',
    missing && '* some components don\'t have this value.',
    !ok && 'Some of it can\'t be computed (missing food or unit conversion).',
  ].filter(Boolean)
  measure.font = `13px ${FONT}`
  const noteLines = notes.flatMap((n) => wrap(measure, n, W - 2 * PAD))

  // Energy by macro: the donut at the left, its legend (each macro, then its kinds) at the right.
  const split = energySplit(nutrients)
  const legend = split.macros.flatMap((m) => [{ ...m, macroRow: true }, ...(m.slices.length > 1 ? m.slices : [])])
  const DONUT = 200
  const chartH = split.total > 0 ? 30 + Math.max(DONUT, legend.length * 20 + 6) + 30 + 14 : 0 // title, chart, note, rule

  // Heights, top to bottom (each block's lines and rules), so the canvas fits exactly.
  const ROW = 30
  const H = PAD + 40 + titleLines.length * 26 + (made ? 22 : 0) + 18 // heading, title, made, thick rule
    + 34 + 10 // per, rule
    + chartH
    + 50 // energy (kcal and kJ)
    + list.filter((r) => r.key !== 'energy').length * ROW
    + (list.some((r) => !r.main) ? 10 : 0) // rule between the main block and the rest
    + 18 + noteLines.length * 18 + PAD

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const g = canvas.getContext('2d')
  g.scale(SCALE, SCALE)
  g.fillStyle = BG
  g.fillRect(0, 0, W, H)
  g.fillStyle = INK
  g.textBaseline = 'alphabetic'
  const line = (x, y, h) => { g.fillStyle = h > 1 ? INK : HAIR; g.fillRect(x, y, W - PAD - x, h) }
  const rule = (y, h) => line(PAD, y, h)
  const VAL_X = W - PAD - 110 // value column's right edge; the ± column ends at the margin
  const text = (s, x, y, font, align = 'left', color = INK) => {
    g.font = `${font} ${FONT}`
    g.textAlign = align
    g.fillStyle = color
    g.fillText(s, x, y)
  }

  let y = PAD + 32
  text('Nutrition facts', PAD, y, '800 34px')
  y += 8
  for (const line of titleLines) text(line, PAD, (y += 26) - 4, '600 20px')
  if (made) text(made, PAD, (y += 22) - 4, '14px', 'left', SOFT)
  y += 8
  rule(y, 8)
  y += 8

  y += 34
  text(`Per ${per}`, PAD, y - 10, '700 20px')
  if (perNote) text(perNote, W - PAD, y - 10, '15px', 'right', SOFT)
  rule(y, 4)
  y += 10

  if (chartH) {
    text('Energy by macro', PAD, y + 22, '700 18px')
    y += 30
    const top = y
    const pct = (x) => `${fmt((x / split.total) * 100, 0)}%`
    // Donut: slices clockwise from the top, 2 px gaps, the total in the middle.
    const cx = PAD + DONUT / 2
    const cy = top + Math.max(DONUT, legend.length * 20 + 6) / 2
    const R = 80
    const slices = split.macros.flatMap((m) => m.slices.filter((sl) => sl.kcal > 0))
    const gap = slices.length > 1 ? 2 / R : 0
    let a = -Math.PI / 2
    g.lineWidth = 30
    g.strokeStyle = '#1b2027'
    g.beginPath()
    g.arc(cx, cy, R, 0, 2 * Math.PI)
    g.stroke()
    for (const sl of slices) {
      const len = (sl.kcal / split.total) * 2 * Math.PI
      g.strokeStyle = colorOf(sl)
      g.beginPath()
      g.arc(cx, cy, R, a, a + Math.max(0.005, len - gap))
      g.stroke()
      a += len
    }
    text(fmt(split.total, 0), cx, cy + 6, '800 32px', 'center')
    text(`${pmText(split.totalN, 0)} kcal`, cx, cy + 26, '13px', 'center', SOFT)
    // Legend: swatch, name, kcal, share.
    const lx = PAD + DONUT + 30
    let ly = top + (Math.max(DONUT, legend.length * 20 + 6) - legend.length * 20) / 2
    for (const r of legend) {
      const kind = !r.macroRow
      g.fillStyle = colorOf(kind ? r : { tone: r.tone, shade: 1 })
      g.fillRect(lx + (kind ? 14 : 0), ly + 5, 10, 10)
      const font = kind ? '13px' : '700 15px'
      const color = kind ? SOFT : INK
      text(r.label, lx + (kind ? 32 : 18), ly + 15, font, 'left', color)
      text(`${fmt(r.kcal, 0)} kcal`, W - PAD - 50, ly + 15, font, 'right', color)
      text(pct(r.kcal), W - PAD, ly + 15, font, 'right', color)
      ly += 20
    }
    y = top + Math.max(DONUT, legend.length * 20 + 6)
    const alcohol = split.macros.some((m) => m.key === 'alcohol') ? ', 7 alcohol' : ''
    text(`From the grams: 9 kcal/g fat, 4 proteins and carbohydrates${alcohol}.`, PAD, y + 20, '13px', 'left', SOFT)
    y += 30
    rule(y, 4)
    y += 14
  }

  const energy = list.find((r) => r.key === 'energy')
  text('Energy', PAD, y + 26, '800 24px')
  text(`${valueText(energy.v)} kcal`, VAL_X, y + 26, '800 24px', 'right')
  text(deltaText(energy.v), W - PAD, y + 26, '15px', 'right', SOFT)
  if (Number.isFinite(energy.v?.value)) {
    const kj = { ...addScaled(zero(), energy.v, 4.184), estimated: energy.v.estimated }
    text(`${valueText(kj)} kJ`, VAL_X, y + 44, '15px', 'right', SOFT)
    text(deltaText(kj), W - PAD, y + 44, '13px', 'right', SOFT)
  }
  y += 50

  let wasMain = true
  for (const r of list) {
    if (r.key === 'energy') continue
    if (wasMain && !r.main) {
      rule(y, 4)
      y += 10
    } else line(PAD + r.indent * 22, y, 1) // none right under a thick rule
    wasMain = r.main
    const base = y + 21
    const bold = r.indent === 0 && r.main
    text(`${r.label}${r.v?.missing ? ' *' : ''}`, PAD + r.indent * 22, base, `${bold ? 700 : 400} 17px`)
    text(`${valueText(r.v)} ${r.unit}`, VAL_X, base, `${bold ? 700 : 400} 17px`, 'right')
    text(deltaText(r.v), W - PAD, base, '14px', 'right', SOFT)
    y += ROW
  }
  rule(y, 8)
  y += 18
  for (const line of noteLines) text(line, PAD, (y += 18) - 4, '13px', 'left', SOFT)
  return canvas
}

/** The label's file name, after the food and the amount: "milanesa-150-g.png". */
export function labelFileName(title, per) {
  const slug = `${title}-${per}`.normalize('NFKD').replace(/[^\w.]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `${slug || 'label'}.png`
}

/** The label as a PNG file named after the food and the amount. */
export function labelFile(canvas, title, per) {
  return new Promise((ok) => canvas.toBlob((b) => ok(new File([b], labelFileName(title, per), { type: 'image/png' })), 'image/png'))
}

// --- The label sheet's choices (screens/LabelSheet.jsx; the Android app's through native/core.js) ----------------
// It starts at what was eaten when the food was opened from a consumption (`log`), else at the Info tab's "per"
// amount; the other choices are a tap away. The eaten amount counts as the consumption does (its ±Δ and entry
// error), so the label matches its info screen; any other amount is taken as exact, as in the Info tab.

const amountLabel = (amount, delta, unit) => `${fmt(amount, 2)}${delta > 0 ? ` ±${fmt(delta, 2)}` : ''} ${unit}`

/** "≈ 75 ±5 g" for an amount in a counted unit (slice, u…), when the food converts it to grams (or ml). */
function measureNote(item, amount, unit) {
  if (!isCountUnit(unit)) return ''
  for (const to of ['g', 'ml']) {
    const [f, lo, hi] = unitFactorSpan(unit, to, item.units)
    if (Number.isFinite(f)) {
      const d = Math.max(hi - f, f - lo) * amount
      return `≈ ${amountLabel(f * amount, d, to)}`
    }
  }
  return ''
}

/**
 * The sheet's choices: {eaten (the consumption, if it's of this food), presets: [{key, text, unit, label}], start}.
 * `per`: the Info tab's amount, {text, unit}.
 */
export function labelChoices(item, log, per) {
  const [baseAmt, baseUnit] = baseAmount(item)
  const eaten = log && log.itemId === item.id ? log : null
  const presets = [
    eaten && { key: 'eaten', text: String(eaten.amount), unit: eaten.unit, label: `Eaten: ${amountLabel(eaten.amount, eaten.amountDelta, eaten.unit)}` },
    { key: 'base', text: String(baseAmt), unit: baseUnit, label: `Food's amount: ${fmt(baseAmt, 2)} ${baseUnit}` },
  ].filter(Boolean)
  return { eaten, presets, start: eaten ? presets[0] : { key: 'per', text: per.text, unit: per.unit } }
}

/** What the label shows for the pick ({key, text, unit}; key 'custom' once typed in): drawLabel's input, or null
 * without an amount. */
export function labelFor(ctx, item, eaten, pick) {
  const head = { title: itemLabel(item), made: madeText(item) }
  if (pick.key === 'eaten' && eaten) {
    const note = [`eaten ${formatDateTime(eaten.datetime)}`, measureNote(item, eaten.amount, eaten.unit)].filter(Boolean).join(' · ')
    return { ...head, per: amountLabel(eaten.amount, eaten.amountDelta, eaten.unit), perNote: note, ...consumptionNutrients(ctx, eaten) }
  }
  const amount = Number(normalizeNumber(pick.text))
  if (!(amount > 0)) return null
  return { ...head, per: `${fmt(amount, 2)} ${pick.unit}`, perNote: measureNote(item, amount, pick.unit), ...nutrientsFor(ctx, item.id, amount, pick.unit, 0) }
}
