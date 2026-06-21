import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { savePayment } from '../db/operations'
import { Layout } from '../components/Layout'
import { SearchModal } from '../components/SearchModal'
import { fmt, today, nowIso, newId } from '../utils/format'

const METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'mobile_money', label: 'Mobile Money' },
  { key: 'bank', label: 'Bank Transfer' },
]

const inputCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

export function RecordPayment() {
  const navigate = useNavigate()

  // 'in' = payment received from customer (reduces their balance_owed)
  // 'out' = payment sent to supplier (reduces what we owe them)
  const [direction, setDirection] = useState('in')
  const [customer, setCustomer] = useState(null)
  const [supplier, setSupplier] = useState(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(today())
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showSupplierPicker, setShowSupplierPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const allCustomers = useLiveQuery(() => db.customers.orderBy('name').toArray(), [])
  const allSuppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), [])

  // Reset entity selection when direction changes
  function setDir(dir) {
    setDirection(dir)
    setCustomer(null)
    setSupplier(null)
  }

  const entity = direction === 'in' ? customer : supplier
  const entityLabel = direction === 'in' ? 'Customer' : 'Supplier'

  async function handleSave() {
    if (!amount || +amount <= 0) {
      setError('Enter a valid amount.')
      return
    }
    if (direction === 'in' && !customer) {
      setError('Select a customer.')
      return
    }
    if (direction === 'out' && !supplier) {
      setError('Select a supplier.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payment = {
        id: newId(),
        related_sale_id: null,
        related_purchase_id: null,
        date,
        amount: parseFloat(amount),
        method,
        direction,
        updated_at: nowIso(),
        synced: 0,
      }
      await savePayment({
        payment,
        customerId: direction === 'in' ? customer?.id : null,
        supplierId: direction === 'out' ? supplier?.id : null,
      })
      navigate('/more')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="Record Payment" showBack>
      <div className="space-y-4 pb-4">

        {/* ── Direction toggle ──────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Payment Direction
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDir('in')}
              className={`py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                direction === 'in'
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              ↓ Received from Customer
            </button>
            <button
              onClick={() => setDir('out')}
              className={`py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                direction === 'out'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              ↑ Paid to Supplier
            </button>
          </div>
        </section>

        {/* ── Entity picker ─────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {entityLabel}
          </p>
          {entity ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{entity.name}</p>
                <p className="text-sm text-yellow-600 font-medium">
                  Balance owed: {fmt(entity.balance_owed ?? 0)}
                </p>
              </div>
              <button
                onClick={() =>
                  direction === 'in'
                    ? setShowCustomerPicker(true)
                    : setShowSupplierPicker(true)
                }
                className="text-xs text-blue-600 underline"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() =>
                direction === 'in'
                  ? setShowCustomerPicker(true)
                  : setShowSupplierPicker(true)
              }
              className="w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50"
            >
              + Select {entityLabel}
            </button>
          )}
        </section>

        {/* ── Amount + date ─────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
            {entity && entity.balance_owed > 0 && (
              <button
                className="text-xs text-blue-600 underline mt-1"
                onClick={() => setAmount(String(entity.balance_owed))}
              >
                Use full balance ({fmt(entity.balance_owed)})
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </section>

        {/* ── Payment method ────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Method
          </p>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  method === key
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold rounded-xl py-4 text-base transition-colors"
        >
          {saving ? 'Saving…' : 'Record Payment'}
        </button>
      </div>

      {/* ── Modals ──────────────────────────────────────── */}
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
              <span className={c.balance_owed > 0 ? 'text-yellow-600 font-medium' : ''}>
                Balance: {fmt(c.balance_owed ?? 0)}
              </span>
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
        emptyMessage="No suppliers yet."
        renderItem={(s) => (
          <div>
            <p className="font-semibold text-gray-800">{s.name}</p>
            <div className="flex gap-4 text-xs text-gray-400 mt-0.5">
              {s.phone && <span>{s.phone}</span>}
              <span className={s.balance_owed > 0 ? 'text-yellow-600 font-medium' : ''}>
                Balance: {fmt(s.balance_owed ?? 0)}
              </span>
            </div>
          </div>
        )}
      />
    </Layout>
  )
}
