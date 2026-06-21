import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { fmt, newId, nowIso } from '../utils/format'

const inputCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

function CustomerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    credit_limit: String(initial?.credit_limit ?? '0'),
  })
  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }))

  async function handleSave() {
    if (!form.name.trim()) return
    await onSave({
      id: initial?.id ?? newId(),
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      credit_limit: parseFloat(form.credit_limit) || 0,
      balance_owed: initial?.balance_owed ?? 0,
      updated_at: nowIso(),
      synced: 0,
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <p className="font-semibold text-gray-700">{initial ? 'Edit Customer' : 'New Customer'}</p>
      <input className={inputCls} placeholder="Name *" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
      <input className={inputCls} placeholder="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      <input type="number" min="0" className={inputCls} placeholder="Credit limit" value={form.credit_limit} onChange={(e) => set('credit_limit', e.target.value)} />
      <div className="flex gap-2">
        <button onClick={handleSave} className="flex-1 bg-blue-700 text-white font-bold rounded-xl py-3">Save</button>
        <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3">Cancel</button>
      </div>
    </div>
  )
}

export function Customers() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), [])

  async function saveCustomer(data) {
    await db.customers.put(data)
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
    <Layout title="Customers" action={addButton} showBack>
      <div className="space-y-3">
        {showForm && (
          <CustomerForm
            initial={editing}
            onSave={saveCustomer}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        )}
        {(customers ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => { setEditing(c); setShowForm(true) }}
            className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{c.name}</p>
                {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
              </div>
              {c.balance_owed > 0 && (
                <span className="text-sm font-bold text-yellow-600">Owes {fmt(c.balance_owed)}</span>
              )}
            </div>
          </button>
        ))}
        {(customers ?? []).length === 0 && !showForm && (
          <p className="text-center text-gray-400 py-10 text-sm">No customers yet. Tap + Add.</p>
        )}
      </div>
    </Layout>
  )
}
