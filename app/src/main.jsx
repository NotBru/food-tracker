import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useRoute } from './components'
import Home from './screens/Home'
import Consumptions from './screens/Consumptions'
import { FoodEditor, FoodList } from './screens/Foods'
import Config from './screens/Config'
import Targets from './screens/Targets'
import External from './screens/External'
import './styles.css'

function App() {
  const { parts, query } = useRoute()
  const [a, b] = parts
  if (a === 'consumptions') return <Consumptions day={query.day} />
  if (a === 'targets') return <Targets />
  if (a === 'config') return <Config />
  if (a === 'foods' && b === 'external') return <External initialQuery={query.q} />
  if (a === 'foods') return b ? <FoodEditor id={b} /> : <FoodList />
  return <Home />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service workers need a secure context (HTTPS or localhost); only used in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('/sw.js')
}

// Ask the browser not to evict our IndexedDB data under storage pressure.
navigator.storage?.persist?.()
