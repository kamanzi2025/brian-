import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { saveReturn } from '../db/operations'
import { Layout } from '../components/Layout'
import { SearchModal } from '../components/SearchModal'
import { fmt, today, nowIso, newId } from '../utils/format'

const VAT_RATE = 0.18

function QtyControl({ value, max, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center"
      >
        −
      </button>
      <input
        type="number"
        min="1"
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max ?? 9999, Math.max(1, parseInt(e.target.value, 10) || 1)))}
        className="w-12 text-center border border-gray-300 rounded-lg py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max ?? 9999, value + 1))}
        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center"
      >
        +
      </button>
    </div>
  )
}

export function NewReturn() {
  const navigate = useNavigate()

  // The user may type an original sale id to link the return
  const [saleLookup, setSaleLookup] = useState('')
  const [linkedSale, setLinkedSale] = useState(null)
  const [lookupError, setLookupError] = useState(null)

  const [items, setItems] = useState([])  // [{ product, quantity, unit_price }]
  const [reason, setReason] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const allProducts = useLiveQuery(() => db.products.orderBy('name').toArray(), [])

  // Load items from linked sale
  const linkedSaleItems = useLiveQuery(
    () =>
      linkedSale
        ? db.sale_items.where('sale_id').equals(linkedSale.id).toArray()
        : Promise.resolve([]),
    [linkedSale?.id]
  )

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const vatAmount = subtotal * VAT_RATE
  const total = subtotal + vatAmount

  async function handleLookupSale() {
    const trimmed = saleLookup.trim()
    if (!trimmed) return
    setLookupError(null)
    try {
      // Accept full UUID or first 8 chars prefix
      let sale = await db.sales.get(trimmed)
      if (!sale) {
        // Try prefix search
        const all = await db.sales.toArray()
        sale = all.find((s) => s.id.startsWith(trimmed)) ?? null
      }
      if (!sale) {
        setLookupError('Sale not found. Check the ID and try again.')
        return
      }
      if (sale.voided) {
        setLookupError('This sale was already voided.')
        return
      }
      setLinkedSale(sale)
    } catch (err) {
      setLookupError(err.message)
    }
  }

  function addFromSaleItem(saleItem) {
    const product = (allProducts ?? []).find((p) => p.id === saleItem.product_id)
    if (!product) return
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) return prev
      return [...prev, { product, quantity: 1, unit_price: saleItem.unit_price, maxQty: saleItem.quantity }]
    })
  }

  function addProduct(product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product, quantity: 1, unit_price: +(product.selling_price ?? 0), maxQty: 9999 }]
    })
  }

  function updateQty(idx, qty) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, quantity: qty } : item)))
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (items.length === 0) {
      setError('Add at least one item.')
      return
    }
    if (reason.trim().length < 3) {
      setError('Enter a reason (at least 3 characters).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const returnId = newId()
      const ts = nowIso()

      const return_ = {
        id: returnId,
        original_sale_id: linkedSale?.id ?? null,
        date: today(),
        reason: reason.trim(),
        status: 'completed',
        subtotal,
        vat_amount: vatAmount,
        total,
        updated_at: ts,
        synced: 0,
      }

      const returnItems = items.map((item) => ({
        id: newId(),
        return_id: returnId,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.product.cost_price ?? 0,
        subtotal: item.quantity * item.unit_price,
      }))

      await saveReturn({ return_, items: returnItems })
      navigate('/returns')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="New Return" showBack>
      <div className="space-y-4 pb-4">

        {/* Link to original sale */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Original Sale (optional)
          </p>
          {linkedSale ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Sale #{linkedSale.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-gray-400">{linkedSale.date} · {fmt(linkedSale.total)}</p>
              </div>
              <button
                onClick={() => { setLinkedSale(null); setSaleLookup(''); }}
                className="text-xs text-gray-400 underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={saleLookup}
                onChange={(e) => setSaleLookup(e.target.value)}
                placeholder="Enter sale ID or first 8 characters…"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleLookupSale}
                className="px-3 py-2 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800"
              >
                Find
              </button>
            </div>
          )}
          {lookupError && <p className="text-xs text-red-500 mt-1">{lookupError}</p>}
        </section>

        {/* Items from the original sale */}
        {linkedSale && (linkedSaleItems ?? []).length > 0 && (
          <section className="bg-blue-50 rounded-xl border border-blue-100 p-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
              Items from original sale
            </p>
            <div className="space-y-1">
              {(linkedSaleItems ?? []).map((si) => {
                const product = (allProducts ?? []).find((p) => p.id === si.product_id)
                const alreadyAdded = items.some((i) => i.product.id === si.product_id)
                return (
                  <div key={si.id} className="flex items-center justify-between gap-2">
                    <p className="text-sm text-blue-800 truncate flex-1">
                      {product?.name ?? si.product_id} × {si.quantity}
                    </p>
                    <button
                      onClick={() => addFromSaleItem(si)}
                      disabled={alreadyAdded}
                      className="text-xs text-blue-700 underline disabled:opacity-40"
                    >
                      {alreadyAdded ? 'Added' : 'Return'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Return items */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
            Items Being Returned
          </p>
          {items.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No items yet.</p>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="px-4 py-3 border-t border-gray-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-800 truncate flex-1">{item.product.name}</p>
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-gray-300 hover:text-red-400 text-lg shrink-0 leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <QtyControl
                    value={item.quantity}
                    max={item.maxQty}
                    onChange={(qty) => updateQty(idx, qty)}
                  />
                  <p className="font-bold text-gray-800">{fmt(item.quantity * item.unit_price)}</p>
                </div>
              </div>
            ))
          )}
          <div className="px-4 pb-4 pt-3 border-t border-gray-50">
            <button
              onClick={() => setShowProductPicker(true)}
              className="w-full border-2 border-dashed border-blue-300 text-blue-600 rounded-xl py-3 text-sm font-semibold hover:bg-blue-50"
            >
              + Add Item Manually
            </button>
          </div>
        </section>

        {/* Reason */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Defective, wrong part, customer changed mind…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        {/* Totals */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>VAT (18%)</span>
            <span>{fmt(vatAmount)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="font-bold text-gray-800">Return Total</p>
            <p className="text-2xl font-bold text-gray-800">{fmt(total)}</p>
          </div>
        </div>

        {error && (
          <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || items.length === 0 || reason.trim().length < 3}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl py-4 text-base"
        >
          {saving ? 'Saving…' : 'Save Return'}
        </button>
      </div>

      <SearchModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        title="Select Product"
        placeholder="Search name or SKU…"
        items={allProducts ?? []}
        searchKeys={['name', 'sku']}
        onSelect={addProduct}
        emptyMessage="No products found."
        renderItem={(p) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{p.name}</p>
              {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
            </div>
            <p className="font-bold text-gray-800 shrink-0">{fmt(p.selling_price)}</p>
          </div>
        )}
      />
    </Layout>
  )
}
