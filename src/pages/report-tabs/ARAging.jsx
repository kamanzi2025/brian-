import { useLiveQuery } from 'dexie-react-hooks'
import { computeARAging, AGING_BUCKETS, BUCKET_COLORS } from '../../reports/compute'
import { fmt } from '../../utils/format'
import { displayDate } from '../../reports/dateHelpers'

export function ARAging() {
  const data = useLiveQuery(() => computeARAging(), [])

  if (!data) {
    return <AgingSkeleton />
  }

  if (data.total === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-3xl mb-2">✅</p>
        <p className="font-medium text-gray-600">No outstanding customer balances</p>
        <p className="text-sm mt-1">All customers are paid up.</p>
      </div>
    )
  }

  return <AgingView data={data} entityLabel="Customer" balanceLabel="Owes" dateLabel="Oldest credit sale" />
}

// ─── Shared aging view (used by both AR and AP) ───────────────────────────────

export function AgingView({ data, entityLabel, balanceLabel, dateLabel }) {
  const { buckets, total, rows } = data

  return (
    <div className="space-y-4">
      {/* ── Total outstanding ──────────────────────────── */}
      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-center">
        <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">
          Total Outstanding
        </p>
        <p className="text-3xl font-bold text-yellow-700 tabular-nums mt-1">{fmt(total)}</p>
        <p className="text-sm text-yellow-600 mt-0.5">{rows.length} {entityLabel.toLowerCase()}{rows.length !== 1 ? 's' : ''}</p>
      </div>

      {/* ── Aging buckets ──────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Aging Buckets (days outstanding)
        </p>
        <div className="space-y-3">
          {AGING_BUCKETS.map((b) => {
            const amount = buckets[b] ?? 0
            const pct = total > 0 ? (amount / total) * 100 : 0
            const colors = BUCKET_COLORS[b]
            return (
              <div key={b}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                    {b} days
                  </span>
                  <span className="text-sm font-bold text-gray-700 tabular-nums">{fmt(amount)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: colors.bar }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5 text-right">{pct.toFixed(0)}%</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Entity list ────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
          Details (oldest first)
        </p>
        {rows.map((row, i) => {
          const colors = BUCKET_COLORS[row.bucket]
          const oldestDate = row.oldestSaleDate ?? row.oldestPurchaseDate
          return (
            <div
              key={row.id}
              className={`px-4 py-3 flex items-start gap-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <span className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${colors.bg} ${colors.text} shrink-0`}>
                {row.daysOutstanding < 999 ? `${row.daysOutstanding}d` : '?'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{row.name}</p>
                {row.phone && <p className="text-xs text-gray-400">{row.phone}</p>}
                <p className="text-xs text-gray-400">
                  {dateLabel}: {oldestDate ? displayDate(oldestDate) : 'Unknown'}
                </p>
              </div>
              <p className="font-bold text-gray-800 text-sm tabular-nums shrink-0">
                {fmt(row.balance_owed)}
              </p>
            </div>
          )
        })}
      </section>
    </div>
  )
}

function AgingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 bg-gray-100 rounded-xl" />
      <div className="h-48 bg-gray-100 rounded-xl" />
      <div className="h-32 bg-gray-100 rounded-xl" />
    </div>
  )
}
