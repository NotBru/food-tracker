import { fold, itemLabel, searchText } from './db'

// Food searches (the Foods list and the food picker): which foods match what's typed, and how well, so "pear" puts
// "Pears, raw" first, before "Babyfood, fruit, pears, junior" and "Spearmint".
//
// A typed word matches a food if it's a word of its name (plurals aside: "pears" finds "Pear"), the start of one
// ("roast" finds "roasted") or a longer form of one ("tomatoes", "tomato"), in its name and brand or (CIQUAL) its
// French name; else if it's anywhere in its text (inside a word, or in an attribute or made-at time), as all searches
// matched before. A food matches if every typed word does. Better matches first:
//   1. fewer words found only inside other words or outside the name ("pear" in "spearmint");
//   2. fewer words matching only part of a word ("pear" in "pearl");
//   3. the name starting with the first word typed ("Pears, raw" over "Prickly pears");
//   4. fewer other words in the name ("Pear nectar" over "Pears, canned, in heavy syrup"); "raw" doesn't count, as it's
//      the plain food ("Pears, raw" over "Pear nectar").
// Callers put their own order (the user's foods first, concoctions by date) between 2 and 3.

// Plurals: "pears" -> pear, "tomatoes" -> tomato (not "glass").
const stem = (w) => (w.length > 3 ? w.replace(/oes$/, 'o').replace(/(?<!s)s$/, '') : w)
const wordsOf = (s) => fold(s ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(stem)

/** The typed text as folded words. */
export const queryWords = (q) => fold(q ?? '').split(/\s+/).filter(Boolean)

/** A food's names as words: name and brand, and CIQUAL's French name. Kept for read-only foods (~11k, unchanging). */
const namesCache = new WeakMap()
function namesOf(item) {
  let n = item.readOnly && namesCache.get(item)
  if (n) return n
  n = [wordsOf(`${item.name ?? ''} ${item.brand ?? ''}`)]
  if (item.nameFr) n.push(wordsOf(item.nameFr))
  if (item.readOnly) namesCache.set(item, n)
  return n
}

/** A typed word against a word of a name: 2 the same word, 1 its start or a longer form of it, 0 neither. */
function wordMatch(q, w) {
  if (q === w) return 2
  return w.startsWith(q) || (w.length >= 4 && q.startsWith(w) && q.length - w.length <= 2) ? 1 : 0
}

// Words of a name that don't make it a different food.
const PLAIN = new Set(['raw', 'cru', 'crue'])

const less = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

/**
 * How well a food matches the typed words (from queryWords): { inside, partial, first, extra } as above, lower is
 * better; null if it doesn't match. No words: everything matches equally.
 */
export function matchRank(item, words) {
  if (!words.length) return { inside: 0, partial: 0, first: 0, extra: 0 }
  const text = searchText(item)
  const qs = words.map(stem)
  let best = null
  names: for (const ws of namesOf(item)) {
    let inside = 0
    let partial = 0
    const used = new Set()
    for (const [i, q] of qs.entries()) {
      let m = 0
      let at = -1
      for (const [j, w] of ws.entries()) {
        const x = wordMatch(q, w)
        if (x > m) [m, at] = [x, j]
        if (m === 2) break
      }
      if (m) {
        used.add(at)
        if (m === 1) partial++
      } else if (text.includes(words[i])) inside++
      else continue names // this name doesn't have it: maybe the other one does
    }
    const extra = ws.filter((w, j) => !used.has(j) && !PLAIN.has(w)).length
    const key = [inside, partial, ws.length && wordMatch(qs[0], ws[0]) ? 0 : 1, extra]
    if (!best || less(key, best)) best = key
  }
  if (!best) return null
  const [inside, partial, first, extra] = best
  return { inside, partial, first, extra }
}

const isOld = (it, before) => !!(before && it.madeAt && it.madeAt < before)

/**
 * The food picker's list (components.jsx ItemPicker) for `query`: [food, label] for the first 50 matches, best first.
 * `exclude`: an id left out. `oldBefore` (ISO time): concoctions made before it go last. `show(item)`: only those it
 * accepts. CIQUAL's and USDA's foods (`ctx.generic()`) come after the user's own, once something is typed.
 */
export function foodMatches(ctx, query, { exclude, oldBefore, show } = {}) {
  const words = queryWords(query)
  return (words.length ? [...ctx.list, ...ctx.generic()] : ctx.list)
    .filter((it) => it.id !== exclude && (!show || show(it)))
    .map((it) => [it, matchRank(it, words)])
    .filter(([, r]) => r)
    .map(([it, r]) => [it, itemLabel(it), r])
    // Old concoctions (if `oldBefore`) last; then the better matches; among those, the user's foods before CIQUAL's
    // and USDA's, most recently made concoctions first; then the closer names, then alphabetical.
    .sort(([a, la, ra], [b, lb, rb]) => isOld(a, oldBefore) - isOld(b, oldBefore) || ra.inside - rb.inside
      || ra.partial - rb.partial || !!a.readOnly - !!b.readOnly || (b.madeAt ?? '').localeCompare(a.madeAt ?? '')
      || ra.first - rb.first || ra.extra - rb.extra || la.localeCompare(lb))
    .slice(0, 50)
}

/**
 * The Foods list for `query` (screens/Foods.jsx FoodList): [food, label]. No search: the user's foods. The better
 * matches first; among those, the user's foods before CIQUAL's and USDA's (the first `genericShown` of them),
 * concoctions after the rest (newest first); then the closer names, then alphabetical.
 */
export function foodListMatches(ctx, query, genericShown = 50) {
  const words = queryWords(query)
  let generic = 0
  return (words.length ? [...ctx.list, ...ctx.generic()] : ctx.list)
    .map((r) => [r, matchRank(r, words)])
    .filter(([, rank]) => rank)
    .map(([r, rank]) => [r, itemLabel(r), rank])
    .sort(([a, la, ra], [b, lb, rb]) => ra.inside - rb.inside || ra.partial - rb.partial || !!a.readOnly - !!b.readOnly
      || !!a.madeAt - !!b.madeAt || (b.madeAt ?? '').localeCompare(a.madeAt ?? '') || ra.first - rb.first
      || ra.extra - rb.extra || la.localeCompare(lb))
    .filter(([r]) => !r.readOnly || ++generic <= genericShown)
}
