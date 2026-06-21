import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { savePurchase } from '../db/operations'
import { Layout } from '../components/Layout'
import { SearchModal } from '../components/SearchModal'
import { fmt, today, nowIso, newId } from '../utils/format'

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

export function NewPurchase() {
  const navigate = useNavigate()

  const [supplier, setSupplier] = useState(null)
  const [items, setItems] = useState([])  // [{ product, quantity, unit_cost }]
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [showSupplierPicker, setShowSupplierPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const allProducts = useLiveQuery(() => db.products.orderBy('name').toArray(), [])
  const allSuppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), [])

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0)

  function addProduct(product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product, quantity: 1, unit_cost: +(product.cost_price ?? 0) }]
    })
  }

  function updateQty(idx, qty) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, quantity: qty } : item)))
  }

  // Unit cost is editable in purchases — price may differ from the stored cost_price
  function updateCost(idx, cost) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, unit_cost: parseFloat(cost) || 0 } : item))
    )
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!supplier) {
      setError('Select a supplier.')
      return
    }
    if (items.length === 0) {
      setError('Add at least one item.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const purchaseId = newId()
      const now = nowIso()
      const purchase = {
        id: purchaseId,
        date: today(),
        supplier_id: supplier.id,
        payment_status: paymentStatus,
        total,
        updated_at: now,
        synced: 0,
      }
      const purchaseItems = items.map((item) => ({
        id: newId(),
        purchase_id: purchaseId,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      }))
      await savePurchase({ purchase, items: purchaseItems })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="New Purchase" showBack>
      <div className="space-y-4 pb-4">

        {/* ── Supplier ──────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Supplier</p>
          {supplier ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{supplier.name}</p>
                {supplier.phone && <p className="text-sm text-gray-400">{supplier.phone}</p>}
              </div>
              <button
                onClick={() => setShowSupplierPicker(true)}
                className="text-xs text-blue-600 underline"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSupplierPicker(true)}
              className="w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50"
            >
              + Select Supplier
            </button>
          )}
        </section>

        {/* ── Line items ────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
            Items Received
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
                  {/* Cost is editable so the user can enter the actual invoice price */}
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(e) => updateCost(idx, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Unit cost"
                    />
                  </div>
                  <p className="font-bold text-gray-800 text-sm shrink-0 w-20 text-right">
                    {fmt(item.quantity * item.unit_cost)}
                  </p>
                </div>
              </div>
            ))
          )}

          <div className="px-4 pb-4 pt-3 border-t border-gray-50">
            <button
              onClick={() => setShowProductPicker(true)}
              className="w-full border-2 border-dashed border-blue-300 text-blue-600 rounded-xl py-3 text-sm font-semibold hover:bg-blue-50 active:bg-blue-100"
            >
              + Add Item
            </button>
          </div>
        </section>

        {/* ── Payment status ────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Payment Status
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'paid', label: 'Paid in Full' },
              { key: 'unpaid', label: 'Pay Later' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPaymentStatus(key)}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  paymentStatus === key
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {paymentStatus === 'unpaid' && supplier && (
            <p className="text-xs text-yellow-600 mt-2">
              ⚠ Total will be added to {supplier.name}'s balance.
            </p>
          )}
        </section>

        {/* ── Total & save ──────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-800">{fmt(total)}</p>
          </div>
          <p className="text-sm text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>

        {error && (
          <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || items.length === 0 || !supplier}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl py-4 text-base transition-colors"
        >
          {saving ? 'Saving…' : 'Save Purchase'}
        </button>
      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      <SearchModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        title="Select Product"
        placeholder="Search name or SKU…"
        items={allProducts ?? []}
        searchKeys={['name', 'sku']}
        onSelect={addProduct}
        emptyMessage="No products found. Add them from Inventory first."
        renderItem={(p) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{p.name}</p>
              {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-gray-800">{fmt(p.cost_price)}</p>
              <p className="text-xs text-gray-400">{p.quantity_on_hand ?? 0} in stock</p>
            </div>
          </div>
        )}
      />

      <SearchModal
        isOpen={showSupplierPicker}
        onClose={() => setShowSupplierPicker(false)}
        title="Select Supplier"
        placeholder="Search supplier name…"
        items={allSuppliers ?? []}
        searchKeys={['name', 'phone']}
        onSelect={setSupplier}
        emptyMessage="No suppliers yet. Add one from the More menu."
        renderItem={(s) => (
          <div>
            <p className="font-semibold text-gray-800">{s.name}</p>
            <div className="flex gap-4 text-xs text-gray-400 mt-0.5">
              {s.phone && <span>{s.phone}</span>}
              {s.balance_owed > 0 && (
                <span className="text-yellow-600 font-medium">Balance: {fmt(s.balance_owed)}</span>
              )}
            </div>
          </div>
        )}
      />
    </Layout>
  )
}
