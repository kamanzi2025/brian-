import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { computeInventory } from '../../reports/compute'
import { fmt } from '../../utils/format'
import { displayDate } from '../../reports/dateHelpers'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low Stock' },
  { key: 'out', label: 'Out of Stock' },
  { key: 'slow', label: 'Slow Movers' },
]

export function InventoryReport() {
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name') // 'name' | 'value' | 'qty'

  const data = useLiveQuery(() => computeInventory(), [])

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
        </div>
        {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
      </div>
    )
  }

  let rows = data.rows

  // Apply filter
  if (filter === 'low') rows = rows.filter((p) => p.isLowStock && !p.isOutOfStock)
  if (filter === 'out') rows = rows.filter((p) => p.isOutOfStock)
  if (filter === 'slow') rows = rows.filter((p) => p.isSlowMover)

  // Apply sort
  if (sortBy === 'value') rows = [...rows].sort((a, b) => b.stockValue - a.stockValue)
  if (sortBy === 'qty') rows = [...rows].sort((a, b) => (a.quantity_on_hand ?? 0) - (b.quantity_on_hand ?? 0))

  return (
    <div className="space-y-4">
      {/* ── Summary cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs font-medium text-blue-600">Stock Value</p>
          <p className="text-lg font-bold text-blue-700 tabular-nums mt-0.5">{fmt(data.totalValue)}</p>
          <p className="text-xs text-blue-500 mt-0.5">{data.totalProducts} products</p>
        </div>
        <div className={`rounded-xl p-3 ${data.outOfStock > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <p className={`text-xs font-medium ${data.outOfStock > 0 ? 'text-red-600' : 'text-gray-500'}`}>
            Out of Stock
          </p>
          <p className={`text-lg font-bold tabular-nums mt-0.5 ${data.outOfStock > 0 ? 'text-red-700' : 'text-gray-600'}`}>
            {data.outOfStock}
          </p>
        </div>
        <div className={`rounded-xl p-3 ${data.lowStock > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
          <p className={`text-xs font-medium ${data.lowStock > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
            Low Stock
          </p>
          <p className={`text-lg font-bold tabular-nums mt-0.5 ${data.lowStock > 0 ? 'text-yellow-700' : 'text-gray-600'}`}>
            {data.lowStock}
          </p>
        </div>
        <div className={`rounded-xl p-3 ${data.slowMovers > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
          <p className={`text-xs font-medium ${data.slowMovers > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
            Slow Movers
          </p>
          <p className={`text-lg font-bold tabular-nums mt-0.5 ${data.slowMovers > 0 ? 'text-orange-700' : 'text-gray-600'}`}>
            {data.slowMovers}
          </p>
          <p className="text-xs text-orange-500 mt-0.5">No sale in 60 days</p>
        </div>
      </div>

      {/* ── Filters & sort ─────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-blue-700 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
          >
            <option value="name">Sort: Name</option>
            <option value="value">Sort: Value ↓</option>
            <option value="qty">Sort: Qty ↑</option>
          </select>
        </div>
      </div>

      {/* ── Product list ───────────────────────────────── */}
      {rows.length === 0 ? (
        <p className="text-center text-gray-400 py-10">No products match this filter.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {rows.map((p, i) => (
            <div
              key={p.id}
              className={`px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                    {p.isOutOfStock && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Out</span>
                    )}
                    {!p.isOutOfStock && p.isLowStock && (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">Low</span>
                    )}
                    {p.isSlowMover && !p.isOutOfStock && (
                      <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">Slow</span>
                    )}
                  </div>
                  {p.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {p.sku}</p>}
                  <p className="text-xs text-gray-400">
                    Last sold: {p.lastSoldDate ? displayDate(p.lastSoldDate) : 'Never'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-800 text-sm">
                    {p.quantity_on_hand ?? 0} units
                  </p>
                  <p className="text-xs text-gray-500">{fmt(p.cost_price)} cost</p>
                  <p className="text-xs text-gray-500 font-medium">{fmt(p.stockValue)} value</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-2">
        Stock value = qty × cost price. Slow mover = no sale in 60 days.
      </p>
    </div>
  )
}
