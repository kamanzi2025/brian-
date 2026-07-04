import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'

self.skipWaiting()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Always fetch HTML from network so new deployments load immediately
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'html-cache',
      networkTimeoutSeconds: 3,
    })
  )
)

// Supabase API — never cache
registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkOnly()
)

// On activate: claim all clients FIRST, then force every open tab to reload
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      await Promise.all(
        clients.map((client) =>
          client.navigate(client.url).catch(() => {
            // navigate() not supported on this browser — send a message instead
            client.postMessage({ type: 'FORCE_RELOAD' })
          })
        )
      )
    })
  )
})

// Fallback: listen for FORCE_RELOAD message (handled in main.jsx)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
