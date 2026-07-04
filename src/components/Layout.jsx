import { useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useSyncStatus } from '../sync/useSyncStatus'

export function Layout({ children, title, showBack = false, action }) {
  const navigate = useNavigate()
  useSyncStatus()

  return (
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
          {title ?? 'AutoParts Store Manager'}
        </h1>

        {action && <div className="shrink-0">{action}</div>}
      </header>

      {/* Page content */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">{children}</main>

      <BottomNav />
    </div>
  )
}
