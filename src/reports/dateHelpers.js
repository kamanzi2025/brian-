// ─── Date range presets for the reports date picker ──────────────────────────
// JavaScript Date month arithmetic handles year boundaries correctly:
//   new Date(2024, -1, 1) → December 1, 2023
//   new Date(2024, 12, 1) → January 1, 2025

const fmt = (d) => d.toISOString().split('T')[0]

export const PRESETS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3m', label: '3 Months' },
  { key: 'this_year', label: 'This Year' },
  { key: 'all_time', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
]

export function getPresetRange(preset) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-indexed

  switch (preset) {
    case 'this_month':
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) }
    case 'last_month':
      return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) }
    case 'last_3m':
      return { from: fmt(new Date(y, m - 2, 1)), to: fmt(new Date(y, m + 1, 0)) }
    case 'this_year':
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    case 'all_time':
      return { from: '2000-01-01', to: '2099-12-31' }
    default:
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) }
  }
}

// Format a YYYY-MM-DD string for display
export function displayDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Days between two ISO date strings
export function daysBetween(fromIso, toIso = new Date().toISOString().split('T')[0]) {
  return Math.floor(
    (new Date(toIso + 'T00:00:00') - new Date(fromIso + 'T00:00:00')) / 86400000
  )
}
