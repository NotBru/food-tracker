// Energy of an amount of food from the grams of each macro (screens/EnergyChart.jsx, and the Android app's native
// chart through native/core.js). Colours are named by tone (fat, prot, carb, muted: the app's colour variables) and
// a slice's `shade`, its share of that colour mixed with the background.
import { addScaled, zero } from './stats'
import { t } from './i18n'

const KCAL_PER_G = { fat: 9, proteins: 4, carbohydrates: 4, alcohol: 7 }

// Kinds of a macro, as far as the food lists them. A kind with kinds of its own is split again (omega-3 is part of
// the polyunsaturated fat, added sugars part of the sugars); `rest` names what the listed kinds leave over.
// Carbohydrates are taken as excluding fibre (EU labels, CIQUAL), like the 4 kcal/g estimate everywhere else.
export const MACROS = [
  { key: 'fat', label: 'Fat', tone: 'fat', rest: 'Unspecified fat', kinds: [
    { key: 'saturatedFat', label: 'Saturated' },
    { key: 'monounsaturatedFat', label: 'Monounsaturated' },
    { key: 'polyunsaturatedFat', label: 'Polyunsaturated', rest: 'Other polyunsaturated', kinds: [{ key: 'omega3', label: 'Omega-3' }] },
    { key: 'transFat', label: 'Trans' },
  ] },
  { key: 'proteins', label: 'Proteins', tone: 'prot' },
  { key: 'carbohydrates', label: 'Carbohydrates', tone: 'carb', rest: 'Starch & other', kinds: [
    { key: 'sugars', label: 'Sugars', rest: 'Other sugars', kinds: [{ key: 'addedSugars', label: 'Added sugars' }] },
  ] },
  { key: 'alcohol', label: 'Alcohol', tone: 'muted', optional: true },
]

/** Grams of `key`, or null when no food in the consumption lists it. */
function grams(n, key) {
  const v = n[key]
  return v && Number.isFinite(v.value) && !(v.missing && v.value === 0) ? Math.max(0, v.value) : null
}

/**
 * `g` grams of `node` -> leaves [{label, g}]. The listed kinds take their share and the rest goes to `rest`; kinds
 * adding up to more than their total (rounded labels) are scaled down to fit. Nothing listed: the node is one leaf.
 */
function split(n, node, g) {
  const parts = (node.kinds ?? []).map((k) => [k, grams(n, k.key)]).filter(([, v]) => v > 0)
  if (!parts.length) return [{ label: t(node.label), g }]
  const sum = parts.reduce((s, [, v]) => s + v, 0)
  const scale = sum > g ? g / sum : 1
  const out = parts.flatMap(([k, v]) => split(n, k, v * scale))
  const rest = g - sum * scale
  if (rest > 1e-9) out.push({ label: t(node.rest), g: rest })
  return out
}

/** Energy from grams, per macro and per kind: {macros: [{…macro, g, n, kcal, kcalN, slices}], total, totalN}; the
 * `…N` are distributions (stats.js) of the grams and the kcal. */
export function energySplit(n) {
  const macros = MACROS.map((m) => {
    const g = grams(n, m.key) ?? 0
    const f = KCAL_PER_G[m.key]
    const leaves = split(n, m, g)
    const slices = leaves.map((l, i) => ({
      ...l, kcal: l.g * f,
      // Shades of the macro's colour, from full to about half-way to the background: the share of the colour.
      shade: leaves.length > 1 ? 1 - (i * 0.55) / (leaves.length - 1) : 1, tone: m.tone,
    }))
    const gN = grams(n, m.key) != null ? n[m.key] : zero()
    return { ...m, label: t(m.label), g, n: gN, kcal: g * f, kcalN: addScaled(zero(), gN, f), slices }
  }).filter((m) => !m.optional || m.g > 0)
  return {
    macros,
    total: macros.reduce((s, m) => s + m.kcal, 0),
    totalN: macros.reduce((t, m) => addScaled(t, m.kcalN), zero()),
  }
}

