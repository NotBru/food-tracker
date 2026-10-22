import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRoute } from './components'
import { getConfig } from './db'
import { setCoverage } from './stats'
import Home from './screens/Home'
import Consumptions from './screens/Consumptions'
import ConsumptionInfo from './screens/ConsumptionInfo'
import { FoodEditor, FoodList } from './screens/Foods'
import Config from './screens/Config'
import Targets from './screens/Targets'
import External from './screens/External'
import Users from './screens/Users'
import Breakdown from './screens/Breakdown'
import Explore from './screens/Explore'
import './styles.css'

function App() {
  const { parts, query } = useRoute()
  // The error intervals' coverage is set before anything is drawn (stats.js).
  const config = useLiveQuery(getConfig)
  if (!config) return null
  setCoverage(config.coverage)
  const [a, b] = parts
  if (a === 'consumptions' && b) return <ConsumptionInfo id={b} nutrient={query.nutrient} />
  if (a === 'consumptions') return <Consumptions day={query.day} add={query.new != null} />
  if (a === 'targets') return <Targets add={query.new != null} />
  if (a === 'config') return <Config />
  if (a === 'users') return <Users />
  if (a === 'explore') return <Explore nutrient={b} />
  if (a === 'breakdown') return <Breakdown key={`${b} ${query.from} ${query.to}`} nutrient={b} from={query.from} to={query.to} win={query.win} per={query.per} />
  if (a === 'foods' && b === 'external') return <External initialQuery={query.q} />
  if (a === 'foods') return b ? <FoodEditor id={b} tab={query.tab} nutrient={query.nutrient} nested={query.in} name={query.name} /> : <FoodList />
  return <Home query={query} />
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
