import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { saveSale } from '../db/operations'
import { Layout } from '../components/Layout'
import { SearchModal } from '../components/SearchModal'
import { fmt, today, nowIso, newId } from '../utils/format'

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'mobile_money', label: 'Mobile Money' },
  { key: 'credit', label: 'On Credit' },
]

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

export function NewSale() {
  const navigate = useNavigate()

  const [customer, setCustomer] = useState(null)
  const [items, setItems] = useState([])
  const [priceMode, setPriceModeState] = useState('retail') // 'retail' | 'wholesale'
  const [includeVat, setIncludeVat] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [salesmanName, setSalesmanName] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const allProducts = useLiveQuery(() => db.products.orderBy('name').toArray(), [])
  const allCustomers = useLiveQuery(() => db.customers.orderBy('name').toArray(), [])

  const hasStockError = items.some((i) => i.quantity > (i.product.qty_store ?? 0))

  const subtotal = items.reduce((sum, i) => sum + i.quantity * (parseFloat(i.unit_price) || 0), 0)
  const vatAmount = includeVat ? subtotal * 0.18 : 0
  const total = subtotal + vatAmount

  function defaultPrice(product, mode) {
    return mode === 'wholesale'
      ? +(product.wholesale_price ?? 0)
      : +(product.selling_price ?? 0)
  }

  // Switch price mode and re-price all items that haven't been manually edited
  function setPriceMode(mode) {
    setPriceModeState(mode)
    setItems((prev) =>
      prev.map((i) => ({
        ...i,
        unit_price: i.manually_edited
          ? i.unit_price
          : defaultPrice(i.product, mode),
      }))
    )
  }

  function addProduct(product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unit_price: defaultPrice(product, priceMode),
          manually_edited: false,
        },
      ]
    })
  }

  function updateQty(idx, qty) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, quantity: qty } : item)))
  }

  function updatePrice(idx, val) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, unit_price: val, manually_edited: true } : item
      )
    )
  }

  // Reset a single item back to the mode default price
  function resetPrice(idx) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, unit_price: defaultPrice(item.product, priceMode), manually_edited: false }
          : item
      )
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
    if (paymentMethod === 'credit' && !customer) {
      setError('Select a customer for a credit sale.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saleId = newId()
      const now = nowIso()
      const sale = {
        id: saleId,
        date: today(),
        customer_id: customer?.id ?? null,
        payment_method: paymentMethod,
        status: 'completed',
        subtotal,
        vat_amount: vatAmount,
        vat_included: includeVat,
        total,
        salesman_name: salesmanName.trim() || null,
        delivery_address: deliveryAddress.trim() || null,
        updated_at: now,
        synced: 0,
      }
      const saleItems = items.map((item) => ({
        id: newId(),
        sale_id: saleId,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.product.cost_price ?? 0,
        subtotal: item.quantity * item.unit_price,
      }))
      await saveSale({ sale, items: saleItems })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="New Sale" showBack>
      <div className="space-y-4 pb-4">

        {/* ── Customer ──────────────────────────────────── */}
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
              Walk-in customer — tap to assign →
            </button>
          )}
        </section>

        {/* ── Salesman + Delivery ───────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Salesman Name
            </label>
            <input
              type="text"
              value={salesmanName}
              onChange={(e) => setSalesmanName(e.target.value)}
              placeholder="e.g. John"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Delivery Address <span className="text-gray-300 normal-case font-normal">(if delivery required)</span>
            </label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Leave blank if customer collects"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </section>

        {/* ── Price mode toggle ─────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Selling Price Type
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'retail', label: 'Retail Price', sub: 'Standard selling price' },
              { key: 'wholesale', label: 'Wholesale Price', sub: 'Bulk / trade price' },
            ].map(({ key, label, sub }) => (
              <button
                key={key}
                onClick={() => setPriceMode(key)}
                className={`py-3 px-3 rounded-xl text-left border-2 transition-colors ${
                  priceMode === key
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-semibold ${priceMode === key ? 'text-blue-700' : 'text-gray-700'}`}>
                  {label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── VAT toggle ────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            VAT
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: true, label: 'Include VAT', sub: '18% added to total' },
              { key: false, label: 'No VAT', sub: 'Sale is VAT-exempt' },
            ].map(({ key, label, sub }) => (
              <button
                key={String(key)}
                onClick={() => setIncludeVat(key)}
                className={`py-3 px-3 rounded-xl text-left border-2 transition-colors ${
                  includeVat === key
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-semibold ${includeVat === key ? 'text-blue-700' : 'text-gray-700'}`}>
                  {label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Line items ────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
            Items
          </p>

          {items.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No items yet.</p>
          ) : (
            items.map((item, idx) => {
              const storeQty = item.product.qty_store ?? 0
              const overStock = item.quantity > storeQty
              const unitPrice = parseFloat(item.unit_price) || 0
              const retailPrice = item.product.selling_price ?? 0
              const wholesalePrice = item.product.wholesale_price ?? 0
              const modeDefault = defaultPrice(item.product, priceMode)
              const isEdited = item.manually_edited && unitPrice !== modeDefault
              return (
                <div key={idx} className={`px-4 py-3 border-t border-gray-50 ${overStock ? 'bg-red-50' : ''}`}>
                  {/* Name + remove */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-400">
                        Retail: {fmt(retailPrice)} · Wholesale: {fmt(wholesalePrice)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-gray-300 hover:text-red-400 text-lg shrink-0 leading-none"
                    >
                      ×
                    </button>
                  </div>

                  {/* Qty + editable unit price + line total */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <QtyControl value={item.quantity} onChange={(qty) => updateQty(idx, qty)} />
                    <span className="text-gray-400 text-sm shrink-0">×</span>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updatePrice(idx, e.target.value)}
                        className={`w-full border rounded-lg px-3 py-1.5 text-sm font-semibold text-right focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          isEdited
                            ? 'border-amber-400 bg-amber-50 text-amber-800'
                            : 'border-gray-300 bg-white text-gray-800'
                        }`}
                      />
                    </div>
                    <p className="font-bold text-gray-800 shrink-0 text-sm w-20 text-right">
                      {fmt(item.quantity * unitPrice)}
                    </p>
                  </div>

                  {/* Reset link if manually edited */}
                  {isEdited && (
                    <button
                      onClick={() => resetPrice(idx)}
                      className="text-xs text-amber-600 underline"
                    >
                      Reset to {priceMode} price ({fmt(modeDefault)})
                    </button>
                  )}

                  {overStock ? (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      Only {storeQty} in store — transfer from warehouse first
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">{storeQty} in store</p>
                  )}
                </div>
              )
            })
          )}

          <div className="px-4 pb-4 pt-3 border-t border-gray-50">
            <button
              onClick={() => setShowProductPicker(true)}
              className="w-full border-2 border-dashed border-blue-300 text-blue-600 rounded-xl py-3 text-sm font-semibold hover:bg-blue-50 active:bg-blue-100"
            >
              + Add Product
            </button>
          </div>
        </section>

        {/* ── Payment method ────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Payment Method
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setPaymentMethod(key)
                  if (key === 'credit' && !customer) setShowCustomerPicker(true)
                }}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  paymentMethod === key
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {paymentMethod === 'credit' && !customer && (
            <p className="text-xs text-yellow-600 mt-2">⚠ Select a customer above for a credit sale.</p>
          )}
          {paymentMethod === 'credit' && customer && customer.credit_limit > 0 &&
            (+(customer.balance_owed ?? 0) + total) > customer.credit_limit && (
            <p className="text-xs text-red-600 mt-2 font-medium">
              ⚠ This sale would exceed {customer.name}'s credit limit of {
                customer.credit_limit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              } (current balance: {(+(customer.balance_owed ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).
            </p>
          )}
        </section>

        {/* ── Total & save ──────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {includeVat && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>VAT (18%)</span>
              <span>{fmt(vatAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="font-bold text-gray-800">Total</p>
            <p className="text-2xl font-bold text-gray-800">{fmt(total)}</p>
          </div>
        </div>

        {hasStockError && (
          <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm font-medium">
            Some items exceed store stock. Go to More → Stock Transfer to move units from warehouse to store.
          </p>
        )}

        {error && (
          <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || items.length === 0 || hasStockError}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl py-4 text-base transition-colors"
        >
          {saving ? 'Saving…' : 'Confirm Sale'}
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
        emptyMessage="No products found. Add some from the Inventory page."
        renderItem={(p) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{p.name}</p>
              {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-gray-800">{fmt(p.selling_price)}</p>
              <p className="text-xs text-gray-400">{p.qty_store ?? 0} store · {p.qty_warehouse ?? 0} wh.</p>
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
            <div className="flex gap-4 text-xs text-gray-400 mt-0.5">
              {c.phone && <span>{c.phone}</span>}
              {c.balance_owed > 0 && (
                <span className="text-yellow-600 font-medium">Owes: {fmt(c.balance_owed)}</span>
              )}
            </div>
          </div>
        )}
      />
    </Layout>
  )
}
