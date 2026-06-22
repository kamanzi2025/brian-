import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { transferStock } from '../db/operations'
import { Layout } from '../components/Layout'
import { SearchModal } from '../components/SearchModal'
import { fmt } from '../utils/format'

export function StockTransfer() {
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const allProducts = useLiveQuery(() => db.products.orderBy('name').toArray(), [])

  // Live-reload the selected product so stock numbers stay current
  const liveProduct = useLiveQuery(
    () => (product ? db.products.get(product.id) : undefined),
    [product?.id]
  )
  const displayed = liveProduct ?? product

  const maxQty = displayed?.qty_warehouse ?? 0

  function handleSelectProduct(p) {
    setProduct(p)
    setQty(1)
    setError(null)
    setSuccess(false)
  }

  async function handleTransfer() {
    if (!product) {
      setError('Select a product first.')
      return
    }
    if (qty < 1) {
      setError('Quantity must be at least 1.')
      return
    }
    if (qty > maxQty) {
      setError(`Only ${maxQty} units in warehouse.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await transferStock({ productId: product.id, qty, note: note.trim() || null })
      setSuccess(true)
      setQty(1)
      setNote('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="Stock Transfer" showBack>
      <div className="space-y-4 pb-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-700">
            Move stock <strong>from Warehouse → Store</strong>. Only warehouse stock can be transferred.
          </p>
        </div>

        {/* Product selector */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Product</p>
          {displayed ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-800">{displayed.name}</p>
                  {displayed.sku && <p className="text-xs text-gray-400">SKU: {displayed.sku}</p>}
                </div>
                <button
                  onClick={() => { setProduct(null); setSuccess(false); setError(null) }}
                  className="text-xs text-gray-400 underline shrink-0"
                >
                  Change
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 rounded-xl border border-amber-100 px-3 py-2">
                  <p className="text-xs text-amber-600 font-semibold">Warehouse</p>
                  <p className="text-xl font-bold text-amber-800">{displayed.qty_warehouse ?? 0}</p>
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-100 px-3 py-2">
                  <p className="text-xs text-blue-600 font-semibold">Store</p>
                  <p className="text-xl font-bold text-blue-800">{displayed.qty_store ?? 0}</p>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPicker(true)}
              className="w-full py-3 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50"
            >
              + Select Product
            </button>
          )}
        </section>

        {/* Quantity */}
        {displayed && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Quantity to Transfer
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max={maxQty}
                value={qty}
                onChange={(e) => setQty(Math.min(maxQty, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="flex-1 text-center border border-gray-300 rounded-xl px-3 py-2.5 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center"
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              Max: {maxQty} units available in warehouse
            </p>
          </section>
        )}

        {/* Note */}
        {displayed && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Restocking shelves for weekend"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </section>
        )}

        {error && (
          <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{error}</p>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-green-700 font-semibold text-sm">
              Transfer complete — stock updated.
            </p>
          </div>
        )}

        {displayed && (
          <button
            onClick={handleTransfer}
            disabled={saving || qty < 1 || qty > maxQty || maxQty === 0}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl py-4 text-base"
          >
            {saving ? 'Transferring…' : `Transfer ${qty} unit${qty !== 1 ? 's' : ''} to Store`}
          </button>
        )}
      </div>

      <SearchModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        title="Select Product"
        placeholder="Search name or SKU…"
        items={(allProducts ?? []).filter((p) => (p.qty_warehouse ?? 0) > 0)}
        searchKeys={['name', 'sku']}
        onSelect={handleSelectProduct}
        emptyMessage="No products with warehouse stock found."
        renderItem={(p) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{p.name}</p>
              {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-amber-700">{p.qty_warehouse ?? 0} wh.</p>
              <p className="text-xs text-gray-400">{p.qty_store ?? 0} store</p>
            </div>
          </div>
        )}
      />
    </Layout>
  )
}
