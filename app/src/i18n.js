// The app's language: English (the texts as written in the code) or Spanish (es.js). Each device picks its own
// (Config → General; a config row of its own, not synced, like the selected user: db.js getConfig, sync.js LOCAL).
// App (main.jsx) sets it before anything is drawn, as it does the coverage; a change re-renders everything.
//
// t(text) is keyed by the English text itself: a text missing from es.js shows in English. `vars` fill "{name}"s;
// if any of them is a React element, the result is an array of parts to render. scripts/i18n-check.mjs lists the
// texts passed to t() that es.js lacks.

import ES from './es'

export const LANGS = ['en', 'es']
let lang = 'en'

export function setLang(l) {
  lang = LANGS.includes(l) ? l : 'en'
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}
export const getLang = () => lang

// Development only: each text missing from es.js, once, in the console.
const warned = new Set()

/** `text` in the current language, its "{name}"s filled from `vars`. */
export function t(text, vars) {
  if (lang === 'es' && !(text in ES) && import.meta.env?.DEV && !warned.has(text) && /[a-z]{2}/i.test(text)) {
    warned.add(text)
    console.warn('i18n: no Spanish for', JSON.stringify(text))
  }
  const s = (lang === 'es' && ES[text]) || text
  if (!vars) return s
  const parts = s.split(/\{(\w+)\}/)
  for (let i = 1; i < parts.length; i += 2) parts[i] = parts[i] in vars ? vars[parts[i]] : `{${parts[i]}}`
  return parts.every((p) => typeof p !== 'object' || p == null) ? parts.join('') : parts
}

/** `one` for 1, else `other` ("{n} foods"), translated, with `n` (and `vars`) filled in. */
export const plural = (n, one, other, vars) => t(n === 1 ? one : other, { n, ...vars })

/**
 * `list`'s objects with `fields` (`label`) read through t() whenever they're read, the English kept (`en`, and
 * `en.<field>` for the others): for tables made once, at load (nutrients, dashboard rows), that follow the language.
 */
export const translated = (list, fields = ['label']) => list.map((o) => {
  const out = { ...o, en: o.label }
  const en = Object.fromEntries(fields.map((f) => [f, o[f]]))
  for (const f of fields) {
    if (o[f] == null) continue
    Object.defineProperty(out, f, { get: () => t(en[f]), enumerable: true })
  }
  return out
})

/** For dates' weekday names (time.js prettyDay). */
export const locale = () => (lang === 'es' ? 'es-AR' : 'en-US')
