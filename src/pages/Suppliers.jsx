import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { fmt, newId, nowIso } from '../utils/format'

const inputCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

function SupplierForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
  })
  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }))

  async function handleSave() {
    if (!form.name.trim()) return
    await onSave({
      id: initial?.id ?? newId(),
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      balance_owed: initial?.balance_owed ?? 0,
      updated_at: nowIso(),
      synced: 0,
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <p className="font-semibold text-gray-700">{initial ? 'Edit Supplier' : 'New Supplier'}</p>
      <input className={inputCls} placeholder="Supplier name *" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
      <input className={inputCls} placeholder="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      <div className="flex gap-2">
        <button onClick={handleSave} className="flex-1 bg-blue-700 text-white font-bold rounded-xl py-3">Save</button>
        <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3">Cancel</button>
      </div>
    </div>
  )
}

export function Suppliers() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
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
        {(suppliers ?? []).map((s) => (
          <button
            key={s.id}
            onClick={() => { setEditing(s); setShowForm(true) }}
            className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{s.name}</p>
                {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
              </div>
              {s.balance_owed > 0 && (
                <span className="text-sm font-bold text-yellow-600">Owe {fmt(s.balance_owed)}</span>
              )}
            </div>
          </button>
        ))}
        {(suppliers ?? []).length === 0 && !showForm && (
          <p className="text-center text-gray-400 py-10 text-sm">No suppliers yet. Tap + Add.</p>
        )}
      </div>
    </Layout>
  )
}
