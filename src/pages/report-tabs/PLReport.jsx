import { useLiveQuery } from 'dexie-react-hooks'
import { computePL, computePLMonthly } from '../../reports/compute'
import { BarChart } from '../../components/BarChart'
import { fmt } from '../../utils/format'

// Renders a single P&L line item: label on the left, value on the right.
// negative=true wraps the value in parentheses (accounting convention).
function PLRow({ label, value, negative, bold, indent, highlight, separator }) {
  if (separator) return <div className="border-t border-gray-200 my-1" />
  const display = negative ? `(${fmt(Math.abs(value))})` : fmt(value)
  const isLoss = highlight && value < 0
  return (
    <div
      className={`flex justify-between items-baseline py-1 ${indent ? 'pl-4' : ''} ${
        bold ? 'font-bold' : ''
      }`}
    >
      <span className={`text-sm ${bold ? 'text-gray-800' : 'text-gray-600'}`}>{label}</span>
      <span
        className={`text-sm tabular-nums ${
          highlight
            ? isLoss
              ? 'text-red-600 font-bold'
              : 'text-green-700 font-bold'
            : bold
            ? 'text-gray-800'
            : 'text-gray-700'
        }`}
      >
        {display}
      </span>
    </div>
  )
}

function Pct({ value }) {
  if (!isFinite(value)) return null
  const color = value >= 0 ? 'text-green-600' : 'text-red-500'
  return <span className={`text-xs ${color} font-medium`}>{value.toFixed(1)}%</span>
}

export function PLReport({ from, to }) {
  const data = useLiveQuery(() => computePL({ from, to }), [from, to])
  const monthly = useLiveQuery(() => computePLMonthly({ from, to }), [from, to])

  if (!data) return <Skeleton />

  const expenseEntries = Object.entries(data.expenseByCategory).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-4">
      {/* ── Summary cards ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard label="Revenue" value={data.revenue} color="blue" />
        <KpiCard label="Expenses" value={data.expenses} color="red" />
        <KpiCard
          label="Net Profit"
          value={data.netProfit}
          color={data.netProfit >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* ── P&L breakdown ──────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Breakdown
        </p>
        <PLRow label={`Revenue  (${data.saleCount} sales)`} value={data.revenue} bold />
        <PLRow label="Cost of Goods Sold" value={data.cogs} negative indent />
        <PLRow separator />
        <div className="flex justify-between items-baseline py-1">
          <span className="text-sm font-bold text-gray-800">Gross Profit</span>
          <div className="flex items-baseline gap-2">
            <Pct value={data.grossMargin} />
            <span className="text-sm font-bold text-gray-800">{fmt(data.grossProfit)}</span>
          </div>
        </div>
        <PLRow label="Operating Expenses" value={data.expenses} negative indent />
        <PLRow separator />
        <div className="flex justify-between items-baseline py-1">
          <span className="font-bold text-gray-800">Net Profit</span>
          <div className="flex items-baseline gap-2">
            <Pct value={data.netMargin} />
            <span
              className={`font-bold text-base tabular-nums ${
                data.netProfit >= 0 ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {data.netProfit < 0 ? `(${fmt(Math.abs(data.netProfit))})` : fmt(data.netProfit)}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          * COGS uses current product cost prices as an approximation.
        </p>
      </section>

      {/* ── VAT collected (informational — not part of revenue/profit) ── */}
      {data.vatCollected > 0 && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-600">VAT Collected (18%)</span>
            <span className="text-sm font-semibold text-gray-700 tabular-nums">
              {fmt(data.vatCollected)}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Shown for reference only — held for tax remittance, not counted as revenue or profit.
          </p>
        </section>
      )}

      {/* ── Expense breakdown ───────────────────────────── */}
      {expenseEntries.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Expenses by Category
          </p>
          {expenseEntries.map(([cat, amount]) => (
            <div key={cat} className="flex items-center gap-3 py-1.5">
              <span className="flex-1 text-sm text-gray-700">{cat}</span>
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-red-400 rounded-full"
                  style={{ width: `${(amount / data.expenses) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700 w-20 text-right tabular-nums">
                {fmt(amount)}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* ── Monthly trend chart ─────────────────────────── */}
      {monthly && monthly.length > 1 && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Monthly Trend
          </p>
          <BarChart
            labels={monthly.map((m) => m.label)}
            series={[
              { name: 'Revenue', color: '#3b82f6', values: monthly.map((m) => m.revenue) },
              { name: 'Net Profit', color: '#22c55e', values: monthly.map((m) => m.netProfit) },
            ]}
            height={180}
          />
          <p className="text-xs text-gray-400 mt-2 text-center">
            Red bars = months with a net loss
          </p>
        </section>
      )}
    </div>
  )
}

function KpiCard({ label, value, color }) {
  const colors = {
    blue: 'text-blue-700 bg-blue-50',
    green: 'text-green-700 bg-green-50',
    red: 'text-red-700 bg-red-50',
  }
  return (
    <div className={`rounded-xl p-3 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5 break-all">{fmt(value)}</p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-48 bg-gray-100 rounded-xl" />
    </div>
  )
}
