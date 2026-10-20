// Known nutrient keys. Values are stored per ingredient as { value, delta }.
// `default: 0` = preset to 0 (design.md); anything else not filled in is stored as NaN.
export const NUTRIENTS = [
  { key: 'energy', label: 'Energy', unit: 'kcal' },
  { key: 'proteins', label: 'Proteins', unit: 'g', default: 0 },
  { key: 'fat', label: 'Fat', unit: 'g', default: 0 },
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g' },
  { key: 'monounsaturatedFat', label: 'Monounsaturated fat', unit: 'g' },
  { key: 'polyunsaturatedFat', label: 'Polyunsaturated fat', unit: 'g' },
  { key: 'omega3', label: 'Omega-3', unit: 'g' },
  { key: 'transFat', label: 'Trans fat', unit: 'g' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
  { key: 'carbohydrates', label: 'Carbohydrates', unit: 'g', default: 0 },
  { key: 'sugars', label: 'Sugars', unit: 'g' },
  { key: 'addedSugars', label: 'Added sugars', unit: 'g' },
  { key: 'fibers', label: 'Fibers', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'salt', label: 'Salt', unit: 'g' },
  { key: 'potassium', label: 'Potassium', unit: 'mg' },
  { key: 'chloride', label: 'Chloride', unit: 'mg' },
  { key: 'calcium', label: 'Calcium', unit: 'mg' },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg' },
  { key: 'iron', label: 'Iron', unit: 'mg' },
  { key: 'zinc', label: 'Zinc', unit: 'mg' },
  { key: 'copper', label: 'Copper', unit: 'mg' },
  { key: 'manganese', label: 'Manganese', unit: 'mg' },
  { key: 'fluoride', label: 'Fluoride', unit: 'mg' },
  { key: 'selenium', label: 'Selenium', unit: 'µg' },
  { key: 'chromium', label: 'Chromium', unit: 'µg' },
  { key: 'molybdenum', label: 'Molybdenum', unit: 'µg' },
  { key: 'iodine', label: 'Iodine', unit: 'µg' },
  { key: 'vitaminA', label: 'Vitamin A', unit: 'µg' },
  { key: 'vitaminB1', label: 'Vitamin B1 (thiamin)', unit: 'mg' },
  { key: 'vitaminB2', label: 'Vitamin B2 (riboflavin)', unit: 'mg' },
  { key: 'vitaminB3', label: 'Vitamin B3 (niacin)', unit: 'mg' },
  { key: 'vitaminB5', label: 'Vitamin B5 (pantothenic acid)', unit: 'mg' },
  { key: 'vitaminB6', label: 'Vitamin B6', unit: 'mg' },
  { key: 'vitaminB7', label: 'Vitamin B7 (biotin)', unit: 'µg' },
  { key: 'vitaminB9', label: 'Vitamin B9 (folate)', unit: 'µg' },
  { key: 'vitaminB12', label: 'Vitamin B12', unit: 'µg' },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg' },
  { key: 'vitaminD', label: 'Vitamin D', unit: 'µg' },
  { key: 'vitaminE', label: 'Vitamin E', unit: 'mg' },
  { key: 'vitaminK', label: 'Vitamin K', unit: 'µg' },
  { key: 'alcohol', label: 'Alcohol', unit: 'g' },
  { key: 'caffeine', label: 'Caffeine', unit: 'mg' },
  { key: 'creatine', label: 'Creatine', unit: 'g' },
  { key: 'water', label: 'Water', unit: 'g' },
]

export const MACROS = ['proteins', 'fat', 'carbohydrates']

export function emptyNutrients() {
  return Object.fromEntries(
    NUTRIENTS.map((n) => [n.key, { value: n.default ?? NaN, delta: n.default === 0 ? 0 : NaN, text: '', deltaAuto: true }]),
  )
}

// Default Δ from the digits typed: one unit of the last digit, same precision as the input ("59.8" -> 0.1, "12" -> 1).
// A trailing dot means one decimal place: "3." is read as "3.0".
export function normalizeNumber(text) {
  const s = String(text).trim()
  return /^[+-]?\d+\.$/.test(s) ? `${s}0` : s
}

export function deltaFromInput(text) {
  const s = normalizeNumber(text)
  if (!s || Number.isNaN(Number(s))) return NaN
  const decimals = s.includes('.') ? s.split('.')[1].length : 0
  return Number((10 ** -decimals).toFixed(decimals))
}

/** Counted units ("u"): a count is exact, so its default error is 0. */
export const isCountUnit = (unit) => String(unit ?? '').trim().toLowerCase() === 'u'

/** Default error of an amount typed as `text` in `unit`: 0 for counted units, otherwise from the digits. */
export function autoAmountDelta(text, unit) {
  return isCountUnit(unit) ? 0 : deltaFromInput(text)
}

/**
 * An amount typed as `text` with its error typed as `deltaText`. A blank error defaults from the digits, like
 * nutrient values ("250" -> ±1, "1.5" -> ±0.1). Stored as {value, text, delta, auto}; the text keeps the precision.
 */
export function measure(text, deltaText, unit) {
  const t = normalizeNumber(text ?? '')
  const auto = String(deltaText ?? '').trim() === ''
  return {
    value: t === '' ? NaN : Number(t),
    text: t,
    delta: auto ? autoAmountDelta(t, unit) || 0 : Math.abs(Number(deltaText)) || 0,
    auto,
  }
}
/** Form texts from stored fields: the amount as typed, and the error (blank when it's the digits default). */
export const amountText = (value, text) => text ?? (Number.isFinite(value) ? String(value) : '')
export const deltaText = (delta, auto) => (auto || !Number.isFinite(delta) ? '' : String(delta))

// Calories shown everywhere: stored energy if known, otherwise Atwater estimate 4/4/9 (+7 alcohol).
export function calories(n) {
  if (n.energy && Number.isFinite(n.energy.value)) return { ...n.energy, estimated: !!n.energy.estimated }
  const v = (k) => (Number.isFinite(n[k]?.value) ? n[k].value : 0)
  const d = (k) => (Number.isFinite(n[k]?.delta) ? n[k].delta : 0)
  return {
    value: 4 * v('proteins') + 4 * v('carbohydrates') + 9 * v('fat') + 7 * v('alcohol'),
    delta: 4 * d('proteins') + 4 * d('carbohydrates') + 9 * d('fat') + 7 * d('alcohol'),
    estimated: true,
  }
}

export function fmt(x, digits = 1) {
  if (!Number.isFinite(x)) return '–'
  return x.toFixed(Math.abs(x) >= 100 ? 0 : digits).replace(/\.0+$/, '')
}

/** "1800–2200", "≥ 120" or "≤ 2300" for a target range. */
export function rangeLabel({ min, max } = {}) {
  const hasMin = Number.isFinite(min)
  const hasMax = Number.isFinite(max)
  if (hasMin && hasMax) return `${fmt(min, 0)}–${fmt(max, 0)}`
  return hasMin ? `≥ ${fmt(min, 0)}` : `≤ ${fmt(max, 0)}`
}
