import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { today, nowIso, newId } from '../utils/format'

const CATEGORIES = [
  'Rent',
  'Salaries',
  'Electricity',
  'Water',
  'Fuel',
  'Bank Loan',
  'Transport',
  'Maintenance',
  'Advertising',
  'Supplies',
  'Other',
]

const inputCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

export function AddExpense() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    date: today(),
    category: '',
    amount: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.amount || +form.amount <= 0) {
      setError('Enter a valid amount.')
      return
    }
    if (!form.category) {
      setError('Select a category.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await db.expenses.put({
        id: newId(),
        date: form.date,
        category: form.category,
        amount: parseFloat(form.amount),
        description: form.description.trim() || null,
        updated_at: nowIso(),
        synced: 0,
      })
      navigate('/more')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="Add Expense" showBack>
      <div className="space-y-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <input
              type="date"
              className={inputCls}
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </Field>
          <Field label="Category" required>
            <select
              className={inputCls}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              <option value="">— Select —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Amount" required>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </Field>

        <Field label="Description">
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Optional notes about this expense…"
          />
        </Field>

        {error && (
          <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold rounded-xl py-4 text-base transition-colors"
        >
          {saving ? 'Saving…' : 'Save Expense'}
        </button>
      </div>
    </Layout>
  )
}
