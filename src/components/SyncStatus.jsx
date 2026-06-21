/**
 * SyncStatus — small pill shown in the top-right corner of every page.
 *
 * Props:
 *   status      — 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
 *   lastSyncedAt — ISO string or null
 *   error        — error message string or null
 *   onRetry      — callback to trigger a manual sync
 */
export function SyncStatus({ status, lastSyncedAt, error, onRetry }) {
  const config = {
    idle: {
      dot: 'bg-gray-400',
      text: 'text-gray-600',
      label: 'Idle',
    },
    syncing: {
      dot: 'bg-blue-500 animate-pulse',
      text: 'text-blue-700',
      label: 'Syncing…',
    },
    synced: {
      dot: 'bg-green-500',
      text: 'text-green-700',
      label: 'Synced',
    },
    offline: {
      dot: 'bg-yellow-500',
      text: 'text-yellow-700',
      label: 'Offline — changes saved locally',
    },
    error: {
      dot: 'bg-red-500',
      text: 'text-red-700',
      label: 'Sync failed',
    },
  }

  const { dot, text, label } = config[status] ?? config.idle

  const formattedTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <span className={`font-medium ${text}`}>{label}</span>
      {formattedTime && status === 'synced' && (
        <span className="text-gray-400">at {formattedTime}</span>
      )}
      {status === 'error' && (
        <button
          onClick={onRetry}
          className="text-xs underline text-red-600 hover:text-red-800"
        >
          Retry
        </button>
      )}
      {error && status === 'error' && (
        <span className="text-xs text-gray-400 truncate max-w-[200px]" title={error}>
          ({error})
        </span>
      )}
    </div>
  )
}
