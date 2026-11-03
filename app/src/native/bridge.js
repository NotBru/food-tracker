// The Android app runs this web app in a WebView inside it, as the engine under its native screens
// (docs/execution/2026-11-03-native-ui.md). The app gives it `window.NativeBridge`:
//   NativeBridge.handles(path) -> whether a native screen shows that route (the web screen then draws nothing);
//   NativeBridge.post(json)    -> a message to the app.
// The app calls in through `window.core`: call (once), watch (again whenever the data it reads changes, like
// useLiveQuery), unwatch, go/replace/back (the router: the web app's hash stays the one navigation state).
import { liveQuery } from 'dexie'
import { getConfig } from '../db'
import { onState } from '../backup'
import { today } from '../time'
import * as views from './core'

export const native = typeof window !== 'undefined' ? window.NativeBridge ?? null : null

/** The route's path ("/", "/consumptions", "/foods/abc"), without its query. */
export const routePath = () => (location.hash.slice(1) || '/').split('?')[0]

/** Whether a native screen shows the current route. */
export const nativeRoute = () => !!native?.handles(routePath())

export function startBridge() {
  const post = (m) => native.post(JSON.stringify(m))
  const fail = (e) => String(e?.message ?? e)
  const watches = new Map() // id -> {name, args, sub}

  function subscribe(id, name, args) {
    const w = { name, args }
    w.sub = liveQuery(() => views[name](...args)).subscribe({
      next: (value) => post({ type: 'watch', id, value }),
      error: (e) => post({ type: 'watch', id, error: fail(e) }),
    })
    watches.set(id, w)
  }
  // Views of "today" re-run when the day changes: live queries only re-run on database changes.
  const rerunAll = () => {
    for (const [id, w] of watches) {
      w.sub.unsubscribe()
      subscribe(id, w.name, w.args)
    }
  }
  let day = null
  const checkDay = async () => {
    const d = today((await getConfig()).dayStart)
    if (day && d !== day) rerunAll()
    day = d
  }
  setInterval(checkDay, 30_000)
  checkDay()

  window.core = {
    async call(id, name, args = []) {
      try {
        post({ type: 'reply', id, ok: true, value: (await views[name](...args)) ?? null })
      } catch (e) {
        post({ type: 'reply', id, ok: false, error: fail(e) })
      }
    },
    watch: (id, name, args = []) => subscribe(id, name, args),
    unwatch(id) {
      watches.get(id)?.sub.unsubscribe()
      watches.delete(id)
    },
    // The app came back to the foreground: the day may have changed while it slept.
    resume: () => checkDay(),
    go: (path) => (location.hash = path),
    replace: (path) => location.replace(`#${path}`),
    back: () => history.back(),
  }
  const route = () => post({ type: 'route', path: location.hash.slice(1) || '/' })
  window.addEventListener('hashchange', route)
  onState(() => post({ type: 'sync', value: views.syncStatus() }))
  post({ type: 'ready', path: location.hash.slice(1) || '/', sync: views.syncStatus() })
}
