import { useNavigate } from 'react-router-dom'
import { SyncStatus } from './SyncStatus'
import { BottomNav } from './BottomNav'
import { useSyncStatus } from '../sync/useSyncStatus'

/**
 * Props
 *   title    — page title shown in the blue header bar
 *   showBack — show a back arrow (navigates -1 in history)
 *   action   — optional JSX to render on the right side of the header
 *              (defaults to the sync status pill)
 */
export function Layout({ children, title, showBack = false, action }) {
  const navigate = useNavigate()
  const { status, lastSyncedAt, error, sync } = useSyncStatus()

  return (
    // pb-20 keeps content above the fixed bottom nav bar
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      {/* Top bar */}
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center gap-3 shadow sticky top-0 z-40">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-white/80 hover:text-white shrink-0"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <h1 className="flex-1 font-bold text-lg tracking-tight truncate">
          {title ?? 'Autoshop Finance Manager'}
        </h1>

        <div className="shrink-0">
          {action ?? (
            <SyncStatus
              status={status}
              lastSyncedAt={lastSyncedAt}
              error={error}
              onRetry={sync}
            />
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">{children}</main>

      <BottomNav />
    </div>
  )
}
