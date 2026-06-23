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
  const [sortBy, setSortBy] = useState('value')

  const data = useLiveQuery(() => computeInventory(), [])

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
        </div>
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
      </div>
    )
  }

  let rows = data.rows

  if (filter === 'low') rows = rows.filter((p) => p.isLowStock && !p.isOutOfStock)
  if (filter === 'out') rows = rows.filter((p) => p.isOutOfStock)
  if (filter === 'slow') rows = rows.filter((p) => p.isSlowMover)

  if (sortBy === 'value') rows = [...rows].sort((a, b) => b.stockValue - a.stockValue)
  if (sortBy === 'qty') rows = [...rows].sort((a, b) => b.qty_total - a.qty_total)
  if (sortBy === 'name') rows = [...rows].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-4">

      {/* ── Value summary cards ───────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-xl p-3 col-span-3">
          <p className="text-xs font-medium text-blue-600">Total Inventory Value</p>
          <p className="text-xl font-bold text-blue-700 tabular-nums mt-0.5">{fmt(data.totalValue)}</p>
          <p className="text-xs text-blue-500 mt-0.5">{data.totalProducts} products</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <p className="text-xs font-medium text-gray-500">Store Value</p>
          <p className="text-sm font-bold text-gray-800 tabular-nums mt-0.5">{fmt(data.totalStoreValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <p className="text-xs font-medium text-gray-500">Warehouse</p>
          <p className="text-sm font-bold text-gray-800 tabular-nums mt-0.5">{fmt(data.totalWarehouseValue)}</p>
        </div>
        <div className={`rounded-xl p-3 ${data.outOfStock > 0 || data.lowStock > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
          <p className={`text-xs font-medium ${data.outOfStock > 0 ? 'text-red-600' : data.lowStock > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
            Alerts
          </p>
          <p className={`text-sm font-bold tabular-nums mt-0.5 ${data.outOfStock > 0 ? 'text-red-700' : 'text-yellow-700'}`}>
            {data.outOfStock > 0 ? `${data.outOfStock} out` : `${data.lowStock} low`}
          </p>
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
            <option value="value">Sort: Value ↓</option>
            <option value="qty">Sort: Qty ↓</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      {/* ── Column header ──────────────────────────────── */}
      {rows.length > 0 && (
        <div className="grid grid-cols-4 gap-1 px-4 py-1.5 bg-gray-50 rounded-lg text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <span className="col-span-2">Product</span>
          <span className="text-right">Units</span>
          <span className="text-right">Value</span>
        </div>
      )}

      {/* ── Product rows ───────────────────────────────── */}
      {rows.length === 0 ? (
        <p className="text-center text-gray-400 py-10">No products match this filter.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {rows.map((p, i) => (
            <div
              key={p.id}
              className={`px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''} ${p.isOutOfStock ? 'bg-red-50' : p.isLowStock ? 'bg-yellow-50' : ''}`}
            >
              {/* Product name + badges */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
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
                    Cost: <span className="font-medium text-gray-600">{fmt(p.cost_price ?? 0)}</span>/unit
                    {p.category ? ` · ${p.category}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-800 text-sm">{fmt(p.stockValue)}</p>
                  <p className="text-xs text-gray-400">total value</p>
                </div>
              </div>

              {/* Store / Warehouse breakdown */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-blue-50 rounded-lg px-3 py-1.5">
                  <p className="text-xs text-blue-500 font-medium">Store</p>
                  <p className="text-sm font-bold text-blue-700">{p.qty_store ?? 0} units</p>
                  <p className="text-xs text-blue-500">{fmt(p.storeValue)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg px-3 py-1.5">
                  <p className="text-xs text-amber-500 font-medium">Warehouse</p>
                  <p className="text-sm font-bold text-amber-700">{p.qty_warehouse ?? 0} units</p>
                  <p className="text-xs text-amber-500">{fmt(p.warehouseValue)}</p>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-1.5">
                Last sold: {p.lastSoldDate ? displayDate(p.lastSoldDate) : 'Never'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer totals ──────────────────────────────── */}
      {rows.length > 0 && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Showing {rows.length} product{rows.length !== 1 ? 's' : ''}</span>
            <span className="font-semibold text-gray-700">
              {rows.reduce((s, p) => s + p.qty_total, 0)} total units
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-200 pt-1">
            <span className="text-gray-500">Filtered inventory value</span>
            <span className="font-bold text-gray-800">
              {fmt(rows.reduce((s, p) => s + p.stockValue, 0))}
            </span>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-2">
        Value = units × cost price. Slow mover = no sale in 60 days.
      </p>
    </div>
  )
}
