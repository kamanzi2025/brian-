import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

let refreshing = false
function doReload() {
  if (!refreshing) {
    refreshing = true
    window.location.reload()
  }
}

// 1. SW took control of this tab
navigator.serviceWorker?.addEventListener('controllerchange', doReload)

// 2. SW sent a direct message
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'FORCE_RELOAD') doReload()
})

// 3. BroadcastChannel — catches updates even on old tabs with no SW listener
try {
  const bc = new BroadcastChannel('sw-reload')
  bc.onmessage = doReload
} catch (_) {}

// 4. vite-plugin-pwa autoUpdate handler
registerSW({ onNeedRefresh: doReload, onOfflineReady() {} })

// 5. Check for a new SW every 60 seconds and on every tab focus
function checkUpdate() {
  navigator.serviceWorker?.getRegistration?.()?.then((reg) => reg?.update())
}
setInterval(checkUpdate, 60_000)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkUpdate()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
