// Lists the texts the app passes to t() / plural() as literals (src/**) that es.js lacks, and es.js entries no code
// uses as a literal (some are used through variables: labels of tables, database names; check before dropping one).
// Usage: node scripts/i18n-check.mjs [--unused]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')
const { default: ES } = await import(path.join(SRC, 'es.js'))
// native/: the Android app's screens, in English (and its own plural()).
const files = fs.readdirSync(SRC, { recursive: true }).filter((f) => /\.jsx?$/.test(f) && f !== 'es.js' && !f.startsWith('native'))

// A JS string literal (no ${…} in a template): its text.
const STR = String.raw`(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|\`((?:\\.|[^\`\\$])*)\`)`
const CALL = new RegExp(String.raw`\b(?:t|plural)\(\s*(?:[^,()]+,\s*)?${STR}(?:\s*,\s*${STR})?`, 'g')
const unescape = (s) => s.replace(/\\(.)/g, (_, c) => ({ n: '\n', t: '\t' }[c] ?? c))

const used = new Map()
for (const f of files) {
  const text = fs.readFileSync(path.join(SRC, f), 'utf8')
  for (const m of text.matchAll(CALL)) {
    for (const s of [m[1] ?? m[2] ?? m[3], m[4] ?? m[5] ?? m[6]]) {
      if (s != null && /[A-Za-z]/.test(s)) used.set(unescape(s), f)
    }
  }
}
const missing = [...used].filter(([k]) => !(k in ES))
for (const [k, f] of missing) console.log(`missing  ${f}: ${JSON.stringify(k)}`)
if (process.argv.includes('--unused')) for (const k of Object.keys(ES)) if (!used.has(k)) console.log(`unused   ${JSON.stringify(k)}`)
console.log(`${used.size} texts, ${missing.length} missing; es.js has ${Object.keys(ES).length}`)
process.exitCode = missing.length ? 1 : 0
