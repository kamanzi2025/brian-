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
  const [items, setItems] = useState([])
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  const [depositPaid, setDepositPaid] = useState('')
  const [freightCost, setFreightCost] = useState('')
  // RMB mode
  const [useRmb, setUseRmb] = useState(false)
  const [exchangeRate, setExchangeRate] = useState('190')
  // Supplier tab
  const [tabId, setTabId] = useState(null)

  const [showProductPicker, setShowProductPicker] = useState(false)
  const [showSupplierPicker, setShowSupplierPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const allProducts = useLiveQuery(() => db.products.orderBy('name').toArray(), [])
  const allSuppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), [])

  // Load open tab for selected supplier
  const openTab = useLiveQuery(
    () => supplier
      ? db.supplier_tabs
          .where('supplier_id').equals(supplier.id)
          .filter((t) => t.status === 'open')
          .first()
      : Promise.resolve(null),
    [supplier?.id]
  )

  // Compute local cost from RMB if mode active
  function rmbToLocal(rmb) {
    const rate = parseFloat(exchangeRate) || 0
    return (parseFloat(rmb) || 0) * rate
  }

  const itemsTotal = items.reduce((sum, i) => {
    const baseCost = useRmb ? rmbToLocal(i.rmb_unit_cost) : i.unit_cost
    const lineFreight = parseFloat(i.freight_cost) || 0
    const lineTax = parseFloat(i.tax_per_item) || 0
    return sum + i.quantity * (baseCost + lineFreight + lineTax)
  }, 0)

  const freightTotal = parseFloat(freightCost) || 0
  const total = itemsTotal + freightTotal

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
          unit_cost: +(product.cost_price ?? 0),
          rmb_unit_cost: '',
          freight_cost: '',
          tax_per_item: '',
        },
      ]
    })
  }

  function updateItem(idx, field, value) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    )
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function getEffectiveCost(item) {
    if (useRmb) return rmbToLocal(item.rmb_unit_cost)
    return parseFloat(item.unit_cost) || 0
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

      const rmbTotal = useRmb
        ? items.reduce((s, i) => s + i.quantity * (parseFloat(i.rmb_unit_cost) || 0), 0)
        : null

      const purchase = {
        id: purchaseId,
        date: today(),
        supplier_id: supplier.id,
        payment_status: paymentStatus,
        total,
        rmb_total: rmbTotal,
        exchange_rate: useRmb ? parseFloat(exchangeRate) : null,
        deposit_paid: parseFloat(depositPaid) || 0,
        freight_cost: freightTotal,
        tab_id: tabId ?? openTab?.id ?? null,
        updated_at: now,
        synced: 0,
      }

      const purchaseItems = items.map((item) => {
        const effectiveCost = getEffectiveCost(item)
        const lineFreight = parseFloat(item.freight_cost) || 0
        const lineTax = parseFloat(item.tax_per_item) || 0
        return {
          id: newId(),
          purchase_id: purchaseId,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_cost: effectiveCost + lineFreight + lineTax,
          rmb_unit_cost: useRmb ? parseFloat(item.rmb_unit_cost) || null : null,
          freight_cost: lineFreight,
          tax_per_item: lineTax,
        }
      })

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
                {openTab && (
                  <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                    Open tab: since {openTab.opened_date}
                  </span>
                )}
              </div>
              <button onClick={() => setShowSupplierPicker(true)} className="text-xs text-blue-600 underline">
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

        {/* ── RMB Mode toggle ───────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">China Supplier / RMB Pricing</p>
              <p className="text-xs text-gray-400">Enter prices in Chinese Yuan (¥)</p>
            </div>
            <button
              onClick={() => setUseRmb((v) => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors ${useRmb ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${useRmb ? 'translate-x-6' : 'translate-x-0.5'}`}
              />
            </button>
          </div>

          {useRmb && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Exchange Rate (1 ¥ =)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-center">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Rate used for all items</p>
                  <p className="text-sm font-bold text-amber-800">1 ¥ = {fmt(parseFloat(exchangeRate) || 0)}</p>
                </div>
              </div>
            </div>
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
            items.map((item, idx) => {
              const effectiveCost = getEffectiveCost(item)
              const lineFreight = parseFloat(item.freight_cost) || 0
              const lineTax = parseFloat(item.tax_per_item) || 0
              const totalCostPerUnit = effectiveCost + lineFreight + lineTax
              return (
                <div key={idx} className="px-4 py-3 border-t border-gray-50 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-800 truncate flex-1">{item.product.name}</p>
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-gray-300 hover:text-red-400 text-lg shrink-0 leading-none"
                    >
                      ×
                    </button>
                  </div>

                  {/* Qty + unit cost */}
                  <div className="flex items-center gap-2">
                    <QtyControl value={item.quantity} onChange={(qty) => updateItem(idx, 'quantity', qty)} />
                    <span className="text-gray-400 text-sm">×</span>
                    <div className="flex-1">
                      {useRmb ? (
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-xs">¥</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rmb_unit_cost}
                            onChange={(e) => updateItem(idx, 'rmb_unit_cost', e.target.value)}
                            className="w-full border border-amber-300 rounded-lg pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            placeholder="RMB price"
                          />
                        </div>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="Unit cost"
                        />
                      )}
                    </div>
                  </div>

                  {/* Freight + Tax per item */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-0.5 block">Freight / item</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.freight_cost}
                        onChange={(e) => updateItem(idx, 'freight_cost', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-0.5 block">Tax / item</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.tax_per_item}
                        onChange={(e) => updateItem(idx, 'tax_per_item', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Line subtotal */}
                  <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">
                    <span>
                      {useRmb && item.rmb_unit_cost
                        ? `¥${item.rmb_unit_cost} × rate = ${fmt(effectiveCost)}`
                        : `Cost: ${fmt(effectiveCost)}`}
                      {lineFreight > 0 ? ` + ${fmt(lineFreight)} freight` : ''}
                      {lineTax > 0 ? ` + ${fmt(lineTax)} tax` : ''}
                    </span>
                    <span className="font-bold text-gray-800">
                      {fmt(item.quantity * totalCostPerUnit)}
                    </span>
                  </div>
                </div>
              )
            })
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

        {/* ── Global freight cost ───────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Sea Freight / Shipping (overall)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={freightCost}
            onChange={(e) => setFreightCost(e.target.value)}
            placeholder="0.00"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Added on top of per-item freight.</p>
        </section>

        {/* ── Deposit paid ──────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Deposit / Advance Paid
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={depositPaid}
            onChange={(e) => setDepositPaid(e.target.value)}
            placeholder="0.00"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {depositPaid && parseFloat(depositPaid) > 0 && (
            <p className="text-xs text-green-700 mt-1">
              Remaining after deposit: {fmt(Math.max(0, total - parseFloat(depositPaid)))}
            </p>
          )}
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

        {/* ── Total breakdown ───────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Items subtotal</span>
            <span>{fmt(itemsTotal)}</span>
          </div>
          {freightTotal > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Sea freight</span>
              <span>{fmt(freightTotal)}</span>
            </div>
          )}
          {depositPaid && parseFloat(depositPaid) > 0 && (
            <div className="flex items-center justify-between text-sm text-green-600">
              <span>Deposit paid</span>
              <span>− {fmt(parseFloat(depositPaid))}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="font-bold text-gray-800">Total</p>
            <p className="text-2xl font-bold text-gray-800">{fmt(total)}</p>
          </div>
          <p className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</p>
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
              <p className="text-xs text-gray-400">{p.qty_store ?? 0} store · {p.qty_warehouse ?? 0} wh.</p>
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
