// Offline support, cache first: the app opens from the last cached copy at once, and the network refreshes that copy
// behind it (stale-while-revalidate). A launch never waits for the network (a weak signal used to hold it up for
// as long as the network took); a new version shows from the launch after it was fetched
// (docs/execution/2026-11-02-fast-start.md).
const CACHE = 'food-tracker-v1'

// Always from the network, never cached: other sites (Open Food Facts), backups, and our copy of Open Food Facts.
const live = (url) => url.origin !== location.origin || url.pathname.startsWith('/backup/') || url.pathname.startsWith('/off/')

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || live(url)) return
  // Every page is the app (routes are in the URL's #), cached as '/'.
  const navigate = e.request.mode === 'navigate'
  const key = navigate ? '/' : e.request
  const fresh = fetch(e.request).then((res) => {
    if (res.ok) e.waitUntil((navigate ? storePage : store)(key, res.clone()).catch(() => {}))
    return res
  })
  // The refresh finishes even when the cached copy answered first.
  e.waitUntil(fresh.catch(() => {}))
  // Not cached yet (the first visit, or a file new to this version): the network's answer, or its error.
  e.respondWith(caches.match(key).then((hit) => hit || fresh))
})

async function store(key, res) {
  await (await caches.open(CACHE)).put(key, res)
}

/**
 * Caches a fetched page once the build files (/assets/, named by their hash) it uses are cached too, so the next launch
 * works offline; until then the old page and its files stay. Then drops the files no longer used: old versions'.
 */
async function storePage(key, res) {
  const html = await res.clone().text()
  const used = new Set(html.match(/\/assets\/[^"'\s)]+/g))
  const cache = await caches.open(CACHE)
  for (const p of used) {
    if (await cache.match(p)) continue
    const a = await fetch(p)
    if (!a.ok) throw new Error(`${p}: HTTP ${a.status}`)
    await cache.put(p, a)
  }
  await cache.put(key, res)
  for (const req of await cache.keys()) {
    const p = new URL(req.url).pathname
    if (p.startsWith('/assets/') && !used.has(p)) await cache.delete(req)
  }
}
