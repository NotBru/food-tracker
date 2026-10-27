// Minimal offline support: network first, fall back to the last cached copy.
const CACHE = 'food-tracker-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  // Backups must come from the server, never from the cache.
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.startsWith('/backup/')) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return res
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
  )
})
