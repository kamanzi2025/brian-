import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { saveQuotation } from '../db/operations'
import { Layout } from '../components/Layout'
import { SearchModal } from '../components/SearchModal'
import { fmt, today, nowIso, newId } from '../utils/format'

const VAT_RATE = 0.18

function QtyControl({ value, onChange }) {
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
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
        className="w-12 text-center border border-gray-300 rounded-lg py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center"
      >
        +
      </button>
    </div>
  )
}

export function NewQuotation() {
  const navigate = useNavigate()

  const [customer, setCustomer] = useState(null)
  const [items, setItems] = useState([])
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const allProducts = useLiveQuery(() => db.products.orderBy('name').toArray(), [])
  const allCustomers = useLiveQuery(() => db.customers.orderBy('name').toArray(), [])

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const vatAmount = subtotal * VAT_RATE
  const total = subtotal + vatAmount

  function addProduct(product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product, quantity: 1, unit_price: +(product.selling_price ?? 0) }]
    })
  }

  function updateQty(idx, qty) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, quantity: qty } : item)))
  }

  function updatePrice(idx, price) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, unit_price: parseFloat(price) || 0 } : item))
    )
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (items.length === 0) {
      setError('Add at least one product.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const quotationId = newId()
      const ts = nowIso()

      const quotation = {
        id: quotationId,
        date: today(),
        expiry_date: expiryDate || null,
        customer_id: customer?.id ?? null,
        status: 'draft',
        subtotal,
        vat_amount: vatAmount,
        total,
        notes: notes.trim() || null,
        converted_sale_id: null,
        updated_at: ts,
        synced: 0,
      }

      const qItems = items.map((item) => ({
        id: newId(),
        quotation_id: quotationId,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.product.cost_price ?? 0,
        subtotal: item.quantity * item.unit_price,
      }))

      await saveQuotation({ quotation, items: qItems })
      navigate(`/quotations/${quotationId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="New Quotation" showBack>
      <div className="space-y-4 pb-4">

        {/* Customer */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Customer</p>
          {customer ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{customer.name}</p>
                {customer.phone && <p className="text-sm text-gray-400">{customer.phone}</p>}
              </div>
              <button onClick={() => setCustomer(null)} className="text-xs text-gray-400 underline">
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomerPicker(true)}
              className="w-full text-left text-gray-400 text-sm py-1"
            >
              Optional — tap to assign customer →
            </button>
          )}
        </section>

        {/* Expiry date */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Expiry Date (optional)
          </label>
          <input
            type="date"
            value={expiryDate}
            min={today()}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        {/* Items */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
            Items
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
                <div className="flex items-center gap-3">
                  <QtyControl value={item.quantity} onChange={(qty) => updateQty(idx, qty)} />
                  <span className="text-gray-400 text-sm">×</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updatePrice(idx, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Unit price"
                    />
                  </div>
                  <p className="font-bold text-gray-800 text-sm shrink-0 w-20 text-right">
                    {fmt(item.quantity * item.unit_price)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div className="px-4 pb-4 pt-3 border-t border-gray-50">
            <button
              onClick={() => setShowProductPicker(true)}
              className="w-full border-2 border-dashed border-blue-300 text-blue-600 rounded-xl py-3 text-sm font-semibold hover:bg-blue-50"
            >
              + Add Product
            </button>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Terms, delivery details…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        {/* Totals */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>VAT (18%)</span>
            <span>{fmt(vatAmount)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="font-bold text-gray-800">Total</p>
            <p className="text-2xl font-bold text-gray-800">{fmt(total)}</p>
          </div>
        </div>

        {error && (
          <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || items.length === 0}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl py-4 text-base"
        >
          {saving ? 'Saving…' : 'Save Quotation'}
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
            <div className="text-right shrink-0">
              <p className="font-bold text-gray-800">{fmt(p.selling_price)}</p>
              <p className="text-xs text-gray-400">{p.qty_store ?? 0} in store</p>
            </div>
          </div>
        )}
      />

      <SearchModal
        isOpen={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        title="Select Customer"
        placeholder="Search name or phone…"
        items={allCustomers ?? []}
        searchKeys={['name', 'phone']}
        onSelect={setCustomer}
        emptyMessage="No customers yet."
        renderItem={(c) => (
          <div>
            <p className="font-semibold text-gray-800">{c.name}</p>
            {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
          </div>
        )}
      />
    </Layout>
  )
}
