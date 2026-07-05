import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'

self.skipWaiting()

cleanupOutdatedCaches()

// Precache JS/CSS/images — NOT index.html (it must always come from network)
precacheAndRoute(self.__WB_MANIFEST)

// index.html: always fetch from network so new deployments load immediately
registerRoute(
  new NavigationRoute(
    new NetworkFirst({ cacheName: 'html-cache', networkTimeoutSeconds: 3 })
  )
)

// Supabase: never cache
registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkOnly()
)

// API routes (version check, ping, etc.): never cache
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly()
)

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Step 1: wipe ALL old caches so no stale files survive
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(async () => {
        // Step 2: tell every open tab to reload via every available method
        try {
          const bc = new BroadcastChannel('sw-reload')
          bc.postMessage('reload')
          setTimeout(() => bc.close(), 1000)
        } catch (_) {}

        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        clients.forEach((client) => {
          try { client.navigate(client.url) } catch (_) {}
          try { client.postMessage({ type: 'FORCE_RELOAD' }) } catch (_) {}
        })
      })
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
