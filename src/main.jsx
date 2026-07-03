import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Auto-register SW (autoUpdate mode handles skipWaiting automatically)
registerSW({ onNeedRefresh() {}, onOfflineReady() {} })

// Reload the page whenever a new SW takes control — this is what actually refreshes the UI
let refreshing = false
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (!refreshing) {
    refreshing = true
    window.location.reload()
  }
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
