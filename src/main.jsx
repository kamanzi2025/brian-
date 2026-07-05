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

// 6. Version-check via API — completely bypasses the SW cache
// Fetches /api/version (a serverless function, never cached by SW).
// If the deployment ID changes while the app is open, this triggers a reload.
let knownVersion = null
async function checkVersion() {
  try {
    const r = await fetch('/api/version', { cache: 'no-store' })
    if (!r.ok) return
    const { v } = await r.json()
    if (knownVersion === null) { knownVersion = v; return }
    if (v !== knownVersion) doReload()
  } catch (_) {}
}
checkVersion()
setInterval(checkVersion, 30_000)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkVersion()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
