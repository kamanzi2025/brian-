import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'

self.skipWaiting()
clientsClaim()

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

// When this new SW activates, force all open tabs to reload
// so they immediately get the new JS bundle — no manual refresh needed
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((client) => client.navigate(client.url))
      })
  )
})
