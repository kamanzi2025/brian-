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

function stockDetail(product) {
  const wh = product.qty_warehouse ?? 0
  const st = product.qty_store ?? 0
  return (
    <p className="text-xs text-gray-400 mt-0.5">
      {st} store · {wh} warehouse
    </p>
  )
}

export function Products() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'low'

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

  const addButton = (
    <button
      onClick={() => navigate('/products/new')}
      className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
    >
      + Add
    </button>
  )

  return (
    <Layout title="Inventory" action={addButton}>
      <div className="space-y-3">
        {/* Search */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, SKU, category…"
          className="w-full border border-gray-300 bg-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Filter tabs */}
        <div className="flex gap-2">
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
        </div>

        {/* List */}
        {allProducts === undefined ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-center text-gray-400 py-10">
            {query ? 'No products match your search.' : 'No products yet. Tap Add to create one.'}
          </p>
        ) : (
          visible.map((product) => (
            <button
              key={product.id}
              onClick={() => navigate(`/products/${product.id}/edit`)}
              className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:bg-gray-50 transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{product.name}</p>
                  {product.sku && (
                    <p className="text-xs text-gray-400 mt-0.5">SKU: {product.sku}</p>
                  )}
                  {product.category && (
                    <p className="text-xs text-gray-400">{product.category}</p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="font-bold text-gray-800">{fmt(product.selling_price)}</p>
                  {stockBadge(product)}
                  {stockDetail(product)}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </Layout>
  )
}
