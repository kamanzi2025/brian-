import { useLiveQuery } from 'dexie-react-hooks'
import { computeCashFlow } from '../../reports/compute'
import { BarChart } from '../../components/BarChart'
import { fmt } from '../../utils/format'
import { displayDate } from '../../reports/dateHelpers'

export function CashFlow({ from, to }) {
  const data = useLiveQuery(() => computeCashFlow({ from, to }), [from, to])

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (data.rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-2xl mb-2">💸</p>
        <p>No cash transactions in this period.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Summary cards ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-xs font-medium text-green-600">Cash In</p>
          <p className="text-lg font-bold text-green-700 tabular-nums mt-0.5">{fmt(data.totalIn)}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3">
          <p className="text-xs font-medium text-red-600">Cash Out</p>
          <p className="text-lg font-bold text-red-700 tabular-nums mt-0.5">{fmt(data.totalOut)}</p>
        </div>
        <div
          className={`rounded-xl p-3 ${
            data.netFlow >= 0 ? 'bg-blue-50' : 'bg-yellow-50'
          }`}
        >
          <p
            className={`text-xs font-medium ${
              data.netFlow >= 0 ? 'text-blue-600' : 'text-yellow-600'
            }`}
          >
            Net Flow
          </p>
          <p
            className={`text-lg font-bold tabular-nums mt-0.5 ${
              data.netFlow >= 0 ? 'text-blue-700' : 'text-yellow-700'
            }`}
          >
            {data.netFlow < 0 ? `(${fmt(Math.abs(data.netFlow))})` : fmt(data.netFlow)}
          </p>
        </div>
      </div>

      {/* ── Weekly chart ───────────────────────────────── */}
      {data.weeklyData.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Weekly Cash Movement
          </p>
          <BarChart
            labels={data.weeklyData.map((w) => w.label)}
            series={[
              { name: 'Cash In', color: '#22c55e', values: data.weeklyData.map((w) => w.in) },
              { name: 'Cash Out', color: '#f87171', values: data.weeklyData.map((w) => w.out) },
            ]}
            height={180}
          />
        </section>
      )}

      {/* ── Transaction log ────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
          Transactions ({data.rows.length})
        </p>
        {data.rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-t border-gray-50"
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                row.direction === 'in' ? 'bg-green-500' : 'bg-red-400'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">{row.label}</p>
              <p className="text-xs text-gray-400">{displayDate(row.date)}</p>
            </div>
            <span
              className={`text-sm font-semibold tabular-nums shrink-0 ${
                row.direction === 'in' ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {row.direction === 'in' ? '+' : '−'}{fmt(row.amount)}
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}
