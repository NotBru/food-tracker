import { useEffect, useMemo, useState } from 'react'
import { MacroLine, Screen } from '../components'
import { ciqualDraft, isBarcode, loadCiqual, offDraft, offProductDraft, searchCiqual, searchOff, setPendingDraft } from '../external'

// "Search external", opened from New food. Picking a result goes back to the form, prefilled (see external.js).
// CIQUAL is local, so it filters as you type; Open Food Facts searches on Enter (rate-limited).

const SOURCES = [['ciqual', 'Generic (CIQUAL)'], ['off', 'Products (OFF)']]

export default function External({ initialQuery = '' }) {
  const [source, setSource] = useState('ciqual')
  const [query, setQuery] = useState(initialQuery)

  return (
    <Screen title="Search external">
      <div className="segmented" role="radiogroup" aria-label="Database">
        {SOURCES.map(([v, label]) => (
          <button key={v} role="radio" aria-checked={source === v} className={source === v ? 'on' : ''} onClick={() => setSource(v)}>{label}</button>
        ))}
      </div>
      {source === 'ciqual' ? <CiqualSearch query={query} setQuery={setQuery} /> : <OffSearch query={query} setQuery={setQuery} />}
    </Screen>
  )
}

function pick(draft) {
  setPendingDraft(draft)
  history.back()
}

function Results({ drafts, empty, onPick = pick }) {
  if (!drafts.length) return empty ? <p className="muted">{empty}</p> : null
  return (
    <ul className="list">
      {drafts.map((d) => (
        <li key={`${d.source.db}:${d.source.id}`} onClick={() => onPick(d)}>
          <div className="list-main">
            <span>{d.name}</span>
            <span className="muted">per 100 {d.unit}</span>
          </div>
          {d.subtitle && <small className="muted">{d.subtitle}</small>}
          <MacroLine nutrients={d.nutrients} />
        </li>
      ))}
    </ul>
  )
}

function CiqualSearch({ query, setQuery }) {
  const [table, setTable] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    loadCiqual().then(setTable, (e) => setError(e.message))
  }, [])
  const drafts = useMemo(() => (table ? searchCiqual(table, query).map((f) => ciqualDraft(table, f)) : []), [table, query])

  return (
    <>
      <input className="search" type="search" autoFocus placeholder="Search generic foods (English or French)…" value={query}
        onChange={(e) => setQuery(e.target.value)} />
      {error ? <p className="warn">{error}</p> : !table ? <p className="muted">Loading the CIQUAL table…</p> : (
        <Results drafts={drafts} empty={query.trim() ? 'No match.' : `${table.foods.length} foods. Type to search, e.g. "egg boiled".`} />
      )}
      <p className="muted small">
        Data: <a href="https://ciqual.anses.fr/" target="_blank" rel="noreferrer">{table?.source ?? 'ANSES-CIQUAL'}</a>, French food
        composition table, {table?.licence ?? 'Licence Ouverte'}. Values per 100 g; Δ from the sources' range where given.
      </p>
    </>
  )
}

function OffSearch({ query, setQuery }) {
  const [state, setState] = useState({ status: 'idle', drafts: [], error: null, searched: '' })
  async function run() {
    const q = query.trim()
    if (!q || state.status === 'loading' || state.status === 'picking') return
    setState({ ...state, status: 'loading', error: null })
    try {
      const products = await searchOff(q)
      setState({ status: 'done', drafts: products.map(offDraft), error: null, searched: q })
    } catch (e) {
      setState({ status: 'error', drafts: [], error: e.message, searched: q })
    }
  }
  async function choose(draft) {
    if (state.status === 'picking') return
    setState({ ...state, status: 'picking' })
    pick(await offProductDraft(draft))
  }

  return (
    <>
      <form className="row search" onSubmit={(e) => { e.preventDefault(); run() }}>
        <input type="search" autoFocus enterKeyHint="search" placeholder="Product name or barcode (all digits)…" value={query}
          onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" disabled={!query.trim() || state.status === 'loading'}>{isBarcode(query) ? 'Look up' : 'Search'}</button>
      </form>
      {state.status === 'loading' && <p className="muted">Searching Open Food Facts…</p>}
      {state.status === 'picking' && <p className="muted">Loading the product…</p>}
      {state.status === 'error' && <p className="warn">{state.error}</p>}
      {state.status === 'done' && <Results drafts={state.drafts} onPick={choose} empty={`Nothing found for "${state.searched}".`} />}
      <p className="muted small">
        Data: <a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer">Open Food Facts</a>, community-made,
        ODbL. Values per 100 g/ml as on the label; check them against your pack. Max 10 searches per minute.
      </p>
    </>
  )
}
