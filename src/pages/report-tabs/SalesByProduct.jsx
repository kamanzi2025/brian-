import { useLiveQuery } from 'dexie-react-hooks'
import { computeSalesByProduct } from '../../reports/compute'
import { fmt } from '../../utils/format'

export function SalesByProduct({ from, to }) {
  const data = useLiveQuery(() => computeSalesByProduct({ from, to }), [from, to])

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl" />
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
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs font-medium text-blue-600 opacity-70">Revenue</p>
          <p className="text-base font-bold text-blue-800 tabular-nums mt-0.5">{fmt(data.totalRevenue)}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3">
          <p className="text-xs font-medium text-orange-600 opacity-70">COGS</p>
          <p className="text-base font-bold text-orange-800 tabular-nums mt-0.5">{fmt(data.totalCogs)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-xs font-medium text-green-600 opacity-70">Gross Profit</p>
          <p className="text-base font-bold text-green-800 tabular-nums mt-0.5">{fmt(data.totalProfit)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span className="col-span-4">Product</span>
          <span className="col-span-2 text-right">Qty</span>
          <span className="col-span-3 text-right">Revenue</span>
          <span className="col-span-3 text-right">Profit</span>
        </div>
        {data.rows.map((row, i) => (
          <div
            key={row.product_id}
            className="px-4 py-3 border-t border-gray-50 grid grid-cols-12 items-center"
          >
            <div className="col-span-4 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{row.name}</p>
              {row.sku && <p className="text-xs text-gray-400">{row.sku}</p>}
            </div>
            <span className="col-span-2 text-right text-sm text-gray-600 tabular-nums">
              {row.qty_sold}
            </span>
            <span className="col-span-3 text-right text-sm text-gray-700 tabular-nums">
              {fmt(row.revenue)}
            </span>
            <div className="col-span-3 text-right">
              <span
                className={`text-sm font-semibold tabular-nums ${
                  row.gross_profit >= 0 ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {fmt(row.gross_profit)}
              </span>
              {row.margin != null && (
                <p className="text-xs text-gray-400">
                  {row.margin.toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
