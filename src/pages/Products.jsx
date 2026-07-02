import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { fmt } from '../utils/format'

function totalQty(p) {
  return (p.qty_warehouse ?? 0) + (p.qty_store ?? 0)
}

function stockBadge(product) {
  const qty = totalQty(product)
  const reorder = product.reorder_level ?? 0
  if (qty === 0)
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Out of stock</span>
  if (reorder > 0 && qty <= reorder)
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Low stock</span>
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{qty} in stock</span>
}

export function Products() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'

  const allProducts = useLiveQuery(() => db.products.orderBy('name').toArray(), [])

  const lowCount = useMemo(
    () =>
      (allProducts ?? []).filter(
        (p) => (p.reorder_level ?? 0) > 0 && totalQty(p) <= (p.reorder_level ?? 0)
      ).length,
    [allProducts]
  )

  const visible = useMemo(() => {
    let list = allProducts ?? []
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.oem_number?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      )
    }
    if (filter === 'low') {
      list = list.filter(
        (p) => (p.reorder_level ?? 0) > 0 && totalQty(p) <= (p.reorder_level ?? 0)
      )
    }
    return list
  }, [allProducts, query, filter])

  // Totals for table footer
  const totals = useMemo(() => ({
    costValue: visible.reduce((s, p) => s + totalQty(p) * (p.cost_price ?? 0), 0),
    wholesaleValue: visible.reduce((s, p) => s + totalQty(p) * (p.wholesale_price ?? 0), 0),
    retailValue: visible.reduce((s, p) => s + totalQty(p) * (p.selling_price ?? 0), 0),
  }), [visible])

  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate('/stock/transfer')}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
      >
        Transfer
      </button>
      <button
        onClick={() => navigate('/products/new')}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
      >
        + Add
      </button>
    </div>
  )

  return (
    <Layout title="Inventory" action={headerActions}>
      <div className="space-y-3">
        {/* Search */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, SKU, part number, category…"
          className="w-full border border-gray-300 bg-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Filter tabs + view toggle */}
        <div className="flex gap-2 items-center flex-wrap">
          {[
            { key: 'all', label: `All (${allProducts?.length ?? 0})` },
            { key: 'low', label: `Low / Out (${lowCount})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
          {/* View mode toggle */}
          <div className="ml-auto flex rounded-lg overflow-hidden border border-gray-200">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'cards' ? 'bg-blue-700 text-white' : 'bg-white text-gray-500'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'table' ? 'bg-blue-700 text-white' : 'bg-white text-gray-500'
              }`}
            >
              Table
            </button>
          </div>
        </div>

        {allProducts === undefined ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-center text-gray-400 py-10">
            {query ? 'No products match your search.' : 'No products yet. Tap Add to create one.'}
          </p>
        ) : viewMode === 'table' ? (
          /* ── TABLE VIEW ─────────────────────────────── */
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item Details</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Part No.</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Cost</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Sell Price</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((product) => {
                    const qty = totalQty(product)
                    const wholesaleVal = qty * (product.wholesale_price ?? 0)
                    const partNo = product.oem_number || product.sku || '—'
                    const date = product.updated_at ? product.updated_at.slice(0, 10) : '—'
                    return (
                      <tr
                        key={product.id}
                        onClick={() => navigate(`/products/${product.id}/edit`)}
                        className="border-t border-gray-50 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{date}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-gray-800 truncate max-w-[140px]">{product.name}</p>
                          {product.category && <p className="text-xs text-gray-400">{product.category}</p>}
                          <p className="text-xs text-gray-400">Qty: {qty}</p>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">{partNo}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700 font-medium whitespace-nowrap">
                          {fmt(product.cost_price ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-700 font-medium whitespace-nowrap">
                          {fmt(product.selling_price ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-800 whitespace-nowrap">
                          {fmt(wholesaleVal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={3} className="px-3 py-2.5 text-xs font-semibold text-gray-500">
                      {visible.length} product{visible.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-700">{fmt(totals.costValue)}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-bold text-blue-700">{fmt(totals.retailValue)}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800">{fmt(totals.wholesaleValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-3 py-2 bg-blue-50 border-t border-blue-100">
              <p className="text-xs text-blue-700">
                Total Value uses <strong>wholesale price</strong> · Cost value: {fmt(totals.costValue)} · Retail value: {fmt(totals.retailValue)}
              </p>
            </div>
          </div>
        ) : (
          /* ── CARDS VIEW ──────────────────────────────── */
          visible.map((product) => {
            const qtyTotal = totalQty(product)
            const costVal = qtyTotal * (product.cost_price ?? 0)
            const wholesaleVal = qtyTotal * (product.wholesale_price ?? 0)
            return (
              <button
                key={product.id}
                onClick={() => navigate(`/products/${product.id}/edit`)}
                className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:bg-gray-50 transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{product.name}</p>
                    {product.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {product.sku}</p>}
                    {product.oem_number && <p className="text-xs text-gray-400">OEM: {product.oem_number}</p>}
                    {product.category && <p className="text-xs text-gray-400">{product.category}</p>}
                  </div>
                  <div className="shrink-0">{stockBadge(product)}</div>
                </div>

                {/* 3 price points */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <div className="bg-gray-50 rounded-lg px-2 py-1.5">
                    <p className="text-xs text-gray-400">Cost</p>
                    <p className="text-sm font-bold text-gray-700">{fmt(product.cost_price ?? 0)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-2 py-1.5">
                    <p className="text-xs text-gray-400">Wholesale</p>
                    <p className="text-sm font-bold text-gray-700">{fmt(product.wholesale_price ?? 0)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg px-2 py-1.5">
                    <p className="text-xs text-blue-500">Retail</p>
                    <p className="text-sm font-bold text-blue-700">{fmt(product.selling_price ?? 0)}</p>
                  </div>
                </div>

                {/* Stock locations */}
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <div className="bg-blue-50 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Store</p>
                    <p className="text-lg font-bold text-blue-700 leading-tight">{product.qty_store ?? 0}</p>
                    <p className="text-xs text-blue-400">units</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-amber-500 uppercase tracking-wide">Warehouse</p>
                    <p className="text-lg font-bold text-amber-700 leading-tight">{product.qty_warehouse ?? 0}</p>
                    <p className="text-xs text-amber-400">units</p>
                  </div>
                </div>

                {qtyTotal > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-400">Cost value</p>
                      <p className="text-sm font-semibold text-gray-700">{fmt(costVal)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Wholesale value</p>
                      <p className="text-sm font-semibold text-green-700">{fmt(wholesaleVal)}</p>
                    </div>
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </Layout>
  )
}
