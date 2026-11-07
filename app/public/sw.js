// Keeps the game playable offline: the page and every bundle it loads are cached on install. Online, the page comes fresh; offline, from the cache.
const CACHE = 'tacticalauto'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const page = await fetch('./', { cache: 'reload' })
      const html = await page.clone().text()
      const assets = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1])
      await cache.put('./', page)
      await cache.addAll(assets)
      self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      if (request.mode === 'navigate') {
        try {
          const fresh = await fetch(request)
          cache.put('./', fresh.clone())
          return fresh
        } catch {
          return (await cache.match('./')) ?? Response.error()
        }
      }
      const hit = await cache.match(request)
      if (hit) return hit
      const fresh = await fetch(request)
      if (fresh.ok) cache.put(request, fresh.clone())
      return fresh
    })(),
  )
})
