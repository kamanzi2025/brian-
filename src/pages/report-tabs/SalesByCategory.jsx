import { useLiveQuery } from 'dexie-react-hooks'
import { computeSalesByCategory } from '../../reports/compute'
import { fmt } from '../../utils/format'

export function SalesByCategory({ from, to }) {
  const data = useLiveQuery(() => computeSalesByCategory({ from, to }), [from, to])

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  if (data.rows.length === 0) {
    return <p className="text-center text-gray-400 py-10">No sales data for this period.</p>
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs font-medium text-blue-600 opacity-70">Total Revenue</p>
          <p className="text-base font-bold text-blue-800 tabular-nums mt-0.5">{fmt(data.totalRevenue)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-xs font-medium text-green-600 opacity-70">Total Profit</p>
          <p className="text-base font-bold text-green-800 tabular-nums mt-0.5">{fmt(data.totalProfit)}</p>
        </div>
      </div>

      {/* Category bars */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
          By Category
        </p>
        {data.rows.map((row) => {
          const pct = data.totalRevenue > 0 ? (row.revenue / data.totalRevenue) * 100 : 0
          return (
            <div key={row.category} className="px-4 py-3 border-t border-gray-50">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium text-gray-800">{row.category}</p>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800 tabular-nums">{fmt(row.revenue)}</p>
                  <p className={`text-xs tabular-nums ${row.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(row.gross_profit)} profit
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-blue-500 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right shrink-0">
                  {pct.toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {row.qty_sold} units · {row.product_count} product{row.product_count !== 1 ? 's' : ''}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
