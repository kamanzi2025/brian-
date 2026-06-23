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
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
      </div>
    )
  }

  let rows = data.rows
  if (filter === 'low') rows = rows.filter((p) => p.isLowStock && !p.isOutOfStock)
  if (filter === 'out') rows = rows.filter((p) => p.isOutOfStock)
  if (filter === 'slow') rows = rows.filter((p) => p.isSlowMover)
  if (sortBy === 'value') rows = [...rows].sort((a, b) => b.stockValue - a.stockValue)
  if (sortBy === 'retail') rows = [...rows].sort((a, b) => b.retailValue - a.retailValue)
  if (sortBy === 'qty') rows = [...rows].sort((a, b) => b.qty_total - a.qty_total)
  if (sortBy === 'name') rows = [...rows].sort((a, b) => a.name.localeCompare(b.name))

  const filteredCostValue = rows.reduce((s, p) => s + p.stockValue, 0)
  const filteredRetailValue = rows.reduce((s, p) => s + p.retailValue, 0)
  const filteredUnits = rows.reduce((s, p) => s + p.qty_total, 0)

  return (
    <div className="space-y-4">

      {/* ── Top summary: 3 valuation cards ─────────────── */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-xs font-medium text-gray-500">Cost Value</p>
            <p className="text-base font-bold text-gray-800 tabular-nums mt-0.5 leading-tight">{fmt(data.totalValue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">what you paid</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <p className="text-xs font-medium text-blue-600">Wholesale</p>
            <p className="text-base font-bold text-blue-700 tabular-nums mt-0.5 leading-tight">{fmt(data.totalWholesaleValue)}</p>
            <p className="text-xs text-blue-400 mt-0.5">at wholesale</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 border border-green-100">
            <p className="text-xs font-medium text-green-600">Retail Value</p>
            <p className="text-base font-bold text-green-700 tabular-nums mt-0.5 leading-tight">{fmt(data.totalRetailValue)}</p>
            <p className="text-xs text-green-400 mt-0.5">if sold retail</p>
          </div>
        </div>

        {/* Store / Warehouse split */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 rounded-xl px-4 py-2.5 flex items-center justify-between border border-blue-100">
            <p className="text-xs font-semibold text-blue-500 uppercase">Store</p>
            <p className="text-sm font-bold text-blue-700">{fmt(data.totalStoreValue)}</p>
          </div>
          <div className="bg-amber-50 rounded-xl px-4 py-2.5 flex items-center justify-between border border-amber-100">
            <p className="text-xs font-semibold text-amber-500 uppercase">Warehouse</p>
            <p className="text-sm font-bold text-amber-700">{fmt(data.totalWarehouseValue)}</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          {data.totalProducts} products · {data.outOfStock} out of stock · {data.lowStock} low stock
        </p>
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
            <option value="value">Sort: Cost ↓</option>
            <option value="retail">Sort: Retail ↓</option>
            <option value="qty">Sort: Qty ↓</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      {/* ── Product rows ───────────────────────────────── */}
      {rows.length === 0 ? (
        <p className="text-center text-gray-400 py-10">No products match this filter.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {rows.map((p, i) => (
            <div
              key={p.id}
              className={`px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''} ${
                p.isOutOfStock ? 'bg-red-50' : p.isLowStock ? 'bg-yellow-50' : ''
              }`}
            >
              {/* Name + badges + total units */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                    {p.isOutOfStock && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Out</span>}
                    {!p.isOutOfStock && p.isLowStock && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">Low</span>}
                    {p.isSlowMover && !p.isOutOfStock && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">Slow</span>}
                  </div>
                  {p.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {p.sku}{p.category ? ` · ${p.category}` : ''}</p>}
                  <p className="text-xs text-gray-400">Last sold: {p.lastSoldDate ? displayDate(p.lastSoldDate) : 'Never'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{p.qty_total} units total</p>
                </div>
              </div>

              {/* 3 price points per unit */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="bg-gray-50 rounded-lg px-2 py-1.5">
                  <p className="text-xs text-gray-400">Cost/unit</p>
                  <p className="text-sm font-bold text-gray-700">{fmt(p.cost_price ?? 0)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-2 py-1.5">
                  <p className="text-xs text-gray-400">Wholesale</p>
                  <p className="text-sm font-bold text-gray-700">{fmt(p.wholesale_price ?? 0)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-2 py-1.5">
                  <p className="text-xs text-blue-500">Retail</p>
                  <p className="text-sm font-bold text-blue-700">{fmt(p.selling_price ?? 0)}</p>
                </div>
              </div>

              {/* Store / Warehouse units */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <div className="bg-blue-50 rounded-lg px-3 py-1.5">
                  <p className="text-xs text-blue-500 font-medium">Store</p>
                  <p className="text-sm font-bold text-blue-700">{p.qty_store ?? 0} units</p>
                  <p className="text-xs text-blue-400">{fmt(p.storeValue)} cost</p>
                </div>
                <div className="bg-amber-50 rounded-lg px-3 py-1.5">
                  <p className="text-xs text-amber-500 font-medium">Warehouse</p>
                  <p className="text-sm font-bold text-amber-700">{p.qty_warehouse ?? 0} units</p>
                  <p className="text-xs text-amber-400">{fmt(p.warehouseValue)} cost</p>
                </div>
              </div>

              {/* Cost → Wholesale → Retail value totals */}
              {p.qty_total > 0 && (
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400">Cost value</p>
                    <p className="text-xs font-semibold text-gray-700">{fmt(p.stockValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Wholesale val.</p>
                    <p className="text-xs font-semibold text-gray-700">{fmt(p.wholesaleValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-400">Retail value</p>
                    <p className="text-xs font-semibold text-green-700">{fmt(p.retailValue)}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Filtered totals footer ─────────────────────── */}
      {rows.length > 0 && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {filter === 'all' ? 'Total' : 'Filtered'} — {rows.length} products · {filteredUnits} units
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-400">Cost value</p>
              <p className="text-sm font-bold text-gray-700">{fmt(filteredCostValue)}</p>
            </div>
            <div>
              <p className="text-xs text-green-500">Retail value</p>
              <p className="text-sm font-bold text-green-700">{fmt(filteredRetailValue)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
