import { useState, useEffect, useCallback, useRef } from 'react'
import { runSync } from './syncEngine'
import { SUPABASE_CONFIGURED } from '../db/supabase'

// Possible states shown in the UI
// 'idle'    — authenticated, online, sync not running
// 'syncing' — sync in progress
// 'synced'  — last sync completed successfully
// 'offline' — browser reports no network connection
// 'error'   — last sync attempt failed

// The last sync error, shared with pages outside this hook (the Home banner)
// since the header status pill was removed.
export const SYNC_ERROR_KEY = 'autoparts_lastSyncError'
export const SYNC_ERROR_EVENT = 'autoparts:sync-error'

function reportSyncError(message) {
  if (message) localStorage.setItem(SYNC_ERROR_KEY, message)
  else localStorage.removeItem(SYNC_ERROR_KEY)
  window.dispatchEvent(new Event(SYNC_ERROR_EVENT))
}

export function useLastSyncError() {
  const [message, setMessage] = useState(() => localStorage.getItem(SYNC_ERROR_KEY))
  useEffect(() => {
    const update = () => setMessage(localStorage.getItem(SYNC_ERROR_KEY))
    window.addEventListener(SYNC_ERROR_EVENT, update)
    return () => window.removeEventListener(SYNC_ERROR_EVENT, update)
  }, [])
  return message
}

export function useSyncStatus() {
  const [status, setStatus] = useState(SUPABASE_CONFIGURED ? 'idle' : 'local')
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
      reportSyncError(null)
    } catch (err) {
      console.error('Sync error:', err)
      setError(err.message)
      setStatus('error')
      reportSyncError(err.message)
    } finally {
      syncingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return

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
