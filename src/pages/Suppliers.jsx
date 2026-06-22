import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { fmt, newId, nowIso } from '../utils/format'

const inputCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

const PAYMENT_TERMS = ['Net 7', 'Net 15', 'Net 30', 'Net 60', 'COD', 'Prepaid']

function SupplierForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    payment_terms: initial?.payment_terms ?? '',
    notes: initial?.notes ?? '',
  })
  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }))

  async function handleSave() {
    if (!form.name.trim()) return
    await onSave({
      id: initial?.id ?? newId(),
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      payment_terms: form.payment_terms.trim() || null,
      notes: form.notes.trim() || null,
      balance_owed: initial?.balance_owed ?? 0,
      updated_at: nowIso(),
      synced: 0,
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <p className="font-semibold text-gray-700">{initial ? 'Edit Supplier' : 'New Supplier'}</p>

      <input
        className={inputCls}
        placeholder="Supplier name *"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          className={inputCls}
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
        <input
          type="email"
          className={inputCls}
          placeholder="Email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
      </div>
      <input
        className={inputCls}
        placeholder="Address"
        value={form.address}
        onChange={(e) => set('address', e.target.value)}
      />
      <div>
        <input
          list="payment-terms-list"
          className={inputCls}
          placeholder="Payment terms (e.g. Net 30)"
          value={form.payment_terms}
          onChange={(e) => set('payment_terms', e.target.value)}
        />
        <datalist id="payment-terms-list">
          {PAYMENT_TERMS.map((t) => <option key={t} value={t} />)}
        </datalist>
      </div>
      <textarea
        className={`${inputCls} resize-none`}
        rows={2}
        placeholder="Notes (optional)"
        value={form.notes}
        onChange={(e) => set('notes', e.target.value)}
      />

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 bg-blue-700 text-white font-bold rounded-xl py-3"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function Suppliers() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), [])

  async function saveSupplier(data) {
    await db.suppliers.put(data)
    setShowForm(false)
    setEditing(null)
  }

  const addButton = (
    <button
      onClick={() => { setEditing(null); setShowForm(true) }}
      className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
    >
      + Add
    </button>
  )

  return (
    <Layout title="Suppliers" action={addButton} showBack>
      <div className="space-y-3">
        {showForm && (
          <SupplierForm
            initial={editing}
            onSave={saveSupplier}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        )}

        {(suppliers ?? []).map((s) => {
          const isExpanded = expandedId === s.id
          return (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
                className="w-full text-left p-4 hover:bg-gray-50 active:bg-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{s.name}</p>
                    <div className="flex gap-3 mt-0.5">
                      {s.phone && <span className="text-xs text-gray-400">{s.phone}</span>}
                      {s.payment_terms && (
                        <span className="text-xs text-blue-600">{s.payment_terms}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.balance_owed > 0 && (
                      <span className="text-sm font-bold text-yellow-600">Owe {fmt(s.balance_owed)}</span>
                    )}
                    <span className="text-gray-300 text-lg">{isExpanded ? '∧' : '∨'}</span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-2">
                  {s.email && (
                    <p className="text-sm text-gray-600">
                      <span className="text-gray-400">Email: </span>{s.email}
                    </p>
                  )}
                  {s.address && (
                    <p className="text-sm text-gray-600">
                      <span className="text-gray-400">Address: </span>{s.address}
                    </p>
                  )}
                  {s.notes && (
                    <p className="text-sm text-gray-600">
                      <span className="text-gray-400">Notes: </span>{s.notes}
                    </p>
                  )}
                  <button
                    onClick={() => { setEditing(s); setShowForm(true); setExpandedId(null) }}
                    className="text-xs text-blue-600 underline mt-1"
                  >
                    Edit supplier
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {(suppliers ?? []).length === 0 && !showForm && (
          <p className="text-center text-gray-400 py-10 text-sm">No suppliers yet. Tap + Add.</p>
        )}
      </div>
    </Layout>
  )
}
