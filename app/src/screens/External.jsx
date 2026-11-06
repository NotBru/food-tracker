import { useState } from 'react'
import { BarcodeIcon, MacroLine, Screen } from '../components'
import { isBarcode, offDraft, offProductDraft, searchOff, setPendingDraft } from '../external'
import ScanSheet from './ScanSheet'

// "Search external", opened from New food: Open Food Facts (our copy on the server), searched on Enter. Picking a result goes
// back to the form, prefilled (see external.js). The barcode button scans a code with the camera (ScanSheet.jsx) and
// looks it up. CIQUAL's generic foods are in the food database itself.

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
  const [scanning, setScanning] = useState(false)
  async function run(q = query.trim()) {
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
        <button type="button" className="icon" onClick={() => setScanning(true)} title="Scan a barcode" aria-label="Scan a barcode"><BarcodeIcon /></button>
        <button type="submit" disabled={!query.trim() || state.status === 'loading'}>{isBarcode(query) ? 'Look up' : 'Search'}</button>
      </form>
      {scanning && <ScanSheet onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); setQuery(code); run(code) }} />}
      {state.status === 'loading' && <p className="muted">Searching Open Food Facts…</p>}
      {state.status === 'picking' && <p className="muted">Loading the product…</p>}
      {state.status === 'error' && <p className="warn">{state.error}</p>}
      {state.status === 'done' && <Results drafts={state.drafts} onPick={choose} empty={`Nothing found for "${state.searched}".`} />}
      <p className="muted small">
        Data: <a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer">Open Food Facts</a>, community-made,
        ODbL. Values per 100 g/ml as on the label; check them against your pack.
      </p>
    </>
  )
}
