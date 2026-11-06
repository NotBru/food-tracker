import { calories, fmt, NUTRIENTS, pmText } from './nutrients'
import { addScaled, getCoverage, sdOf, zero } from './stats'

// A food's nutrition label as an image: one fixed layout (black on white, like a package's table), whatever the
// food or the screen. Values and their ± as in the Info tab's table (FoodInfo.jsx), from the same nutrientsFor.

const W = 600 // CSS px; drawn at SCALE for a sharp PNG
const SCALE = 2
const PAD = 24
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif'
const INK = '#000'
const SOFT = '#555'

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

  // Heights, top to bottom (each block's lines and rules), so the canvas fits exactly.
  const ROW = 30
  const H = PAD + 40 + titleLines.length * 26 + (made ? 22 : 0) + 18 // heading, title, made, thick rule
    + 34 + 10 // per, rule
    + 50 // energy (kcal and kJ)
    + list.filter((r) => r.key !== 'energy').length * ROW
    + (list.some((r) => !r.main) ? 10 : 0) // rule between the main block and the rest
    + 18 + noteLines.length * 18 + PAD

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const g = canvas.getContext('2d')
  g.scale(SCALE, SCALE)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, W, H)
  g.fillStyle = INK
  g.textBaseline = 'alphabetic'
  const line = (x, y, h) => { g.fillStyle = INK; g.fillRect(x, y, W - PAD - x, h) }
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

/** The label as a PNG file named after the food and the amount. */
export function labelFile(canvas, title, per) {
  const slug = `${title}-${per}`.normalize('NFKD').replace(/[^\w.]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return new Promise((ok) => canvas.toBlob((b) => ok(new File([b], `${slug || 'label'}.png`, { type: 'image/png' })), 'image/png'))
}
