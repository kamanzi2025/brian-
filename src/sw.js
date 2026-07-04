import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'

self.skipWaiting()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  new NavigationRoute(
    new NetworkFirst({ cacheName: 'html-cache', networkTimeoutSeconds: 3 })
  )
)

registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkOnly()
)

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(async () => {
      // 1. BroadcastChannel — reaches ALL tabs from same origin, no SW control needed
      try {
        const bc = new BroadcastChannel('sw-reload')
        bc.postMessage('reload')
        setTimeout(() => bc.close(), 1000)
      } catch (_) {}

      // 2. postMessage + navigate every open window
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
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
