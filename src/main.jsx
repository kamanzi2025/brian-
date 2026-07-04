import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Auto-register SW (autoUpdate mode handles skipWaiting automatically)
registerSW({ onNeedRefresh() {}, onOfflineReady() {} })

// Reload whenever a new SW takes control or sends a FORCE_RELOAD message
let refreshing = false
function doReload() {
  if (!refreshing) {
    refreshing = true
    window.location.reload()
  }
}
navigator.serviceWorker?.addEventListener('controllerchange', doReload)
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'FORCE_RELOAD') doReload()
})

// Force an SW update check every time the user opens or returns to the app
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    navigator.serviceWorker?.getRegistration?.()?.then((reg) => reg?.update())
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
