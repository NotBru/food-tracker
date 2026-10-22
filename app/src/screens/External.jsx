import { useState } from 'react'
import { MacroLine, Screen } from '../components'
import { isBarcode, offDraft, offProductDraft, searchOff, setPendingDraft } from '../external'

// "Search external", opened from New food: Open Food Facts, searched on Enter (rate-limited). Picking a result goes
// back to the form, prefilled (see external.js). CIQUAL's generic foods are in the food database itself.

export default function External({ initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery)
  return (
    <Screen title="Search Open Food Facts">
      <OffSearch query={query} setQuery={setQuery} />
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
