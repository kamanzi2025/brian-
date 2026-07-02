import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Auto-reload the page whenever a new version is deployed
registerSW({
  onNeedRefresh() {
    // New version available — reload immediately
    window.location.reload()
  },
  onOfflineReady() {},
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
