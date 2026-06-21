import { useState, useEffect, useCallback, useRef } from 'react'
import { runSync } from './syncEngine'

// Possible states shown in the UI
// 'idle'    — authenticated, online, sync not running
// 'syncing' — sync in progress
// 'synced'  — last sync completed successfully
// 'offline' — browser reports no network connection
// 'error'   — last sync attempt failed

export function useSyncStatus() {
  const [status, setStatus] = useState('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState(
    () => localStorage.getItem('autoparts_lastSyncedAt') ?? null
  )
  const [error, setError] = useState(null)
  const syncingRef = useRef(false) // guard against concurrent sync runs

  const sync = useCallback(async () => {
    if (syncingRef.current) return // already running
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }

    syncingRef.current = true
    setStatus('syncing')
    setError(null)

    try {
      const syncedAt = await runSync()
      setLastSyncedAt(syncedAt)
      setStatus('synced')
    } catch (err) {
      console.error('Sync error:', err)
      setError(err.message)
      setStatus('error')
    } finally {
      syncingRef.current = false
    }
  }, [])

  useEffect(() => {
    // Sync on mount
    sync()

    // Sync whenever the browser regains network connectivity
    const handleOnline = () => sync()
    const handleOffline = () => setStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Sync every 5 minutes while the app is open and online
    const interval = setInterval(() => {
      if (navigator.onLine) sync()
    }, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [sync])

  return { status, lastSyncedAt, error, sync }
}
