import { baseAmount, nutrientsFor } from './calc'
import { calories, fmt } from './nutrients'
import { bounds } from './stats'
import { energySplit } from './energy'

// Explore's ranking (screens/Explore.jsx; the Android app's native screen too): one nutrient across the food
// databases, the foods ranked by the share of their energy the nutrient's low end reaches.

export const USER_DB = 'user'
export const databaseOf = (item) => item.attributes?.find(([k]) => k?.toLowerCase() === 'database')?.[1] || USER_DB

/** The nutrient (energy from macros when it isn't listed, as everywhere) of `amount unit` of `item`, or null. */
function amountOf(ctx, item, key, amount, unit) {
  const res = nutrientsFor(ctx, item.id, amount, unit)
  if (!res.ok) return null
  const n = key === 'energy' ? calories(res.nutrients) : res.nutrients[key]
  return n && Number.isFinite(n.value) ? { n, nutrients: res.nutrients } : null
}

// kcal per gram of the nutrients that carry energy, kinds included (EnergyChart's Atwater factors; it counts no
// energy from fibre).
const KCAL_PER_G = {
  fat: 9, saturatedFat: 9, monounsaturatedFat: 9, polyunsaturatedFat: 9, omega3: 9, transFat: 9,
  proteins: 4, carbohydrates: 4, sugars: 4, addedSugars: 4, alcohol: 7,
}

/**
 * The nutrient's low end (interval shown) against the food's energy from its macros (means, as in the chart). A
 * nutrient with energy: its share with it at its low end and the rest at their means, f·lo / (E − f·mean + f·lo), e.g.
 * 4·P_lo / (4·P_lo + 4·C + 9·F); foods missing any of P, C, F go last. One without: per 100 kcal. Energy itself: per its amount. [rank, text]; no energy:
 * [-Infinity].
 */
const listed = (n) => !!n && Number.isFinite(n.value) && !n.missing
const MAIN = ['proteins', 'fat', 'carbohydrates']

function rank(key, n, energy, per, unit, nutrients) {
  const lo = bounds(n)[0]
  if (key === 'energy') return [lo, `≥ ${fmt(lo, 0)} kcal per ${fmt(per[0], 2)} ${per[1]}`]
  if (!(energy > 0)) return [-Infinity, 'no energy']
  const f = KCAL_PER_G[key]
  if (f) {
    // Unlisted macros would count as 0 and push the share to 100% (CIQUAL's leek has no carbohydrates): last.
    if (!MAIN.every((k) => listed(nutrients[k]))) return [-Infinity, 'macros incomplete']
    const share = (lo * f) / (energy - n.value * f + lo * f)
    return [share, `≥ ${fmt(share * 100, 0)}% of energy`]
  }
  return [lo / energy, `≥ ${fmt((lo * 100) / energy, 2)} ${unit} per 100 kcal`]
}

/**
 * Every food with the nutrient (`meta`: its row or NUTRIENTS entry), ranked: [{item, db, per, score, text, n,
 * nutrients}]. Per 100 g, or the food's own amount when it has no grams. Concoctions are batches, not foods: left out.
 */
export function exploreFoods(ctx, nutrient, meta) {
  const rows = []
  for (const item of [...ctx.list, ...ctx.generic()]) {
    if (item.madeAt) continue
    let per = [100, 'g']
    let r = amountOf(ctx, item, nutrient, ...per)
    if (!r) {
      per = baseAmount(item).slice(0, 2)
      r = amountOf(ctx, item, nutrient, ...per)
    }
    if (!r) continue
    const [score, text] = rank(nutrient, r.n, energySplit(r.nutrients).total, per, meta.unit, r.nutrients)
    rows.push({ item, db: databaseOf(item), per, score, text, ...r })
  }
  // Ties (all of the energy: oils for fat, lean fish for protein): the most of the nutrient first.
  return rows.sort((a, b) => b.score - a.score || b.n.value - a.n.value)
}

/** The databases to switch: yours first, then the others by name. */
export const exploreDbs = (foods) => [USER_DB, ...[...new Set(foods.map((f) => f.db))].filter((d) => d !== USER_DB).sort()]
