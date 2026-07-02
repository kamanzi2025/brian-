import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { newId, nowIso } from '../utils/format'

const inputCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

const FIELDS = [
  { key: 'rent',        label: 'Rent',          emoji: '🏢' },
  { key: 'salaries',    label: 'Salaries',       emoji: '👥' },
  { key: 'electricity', label: 'Electricity',    emoji: '⚡' },
  { key: 'water',       label: 'Water',          emoji: '💧' },
  { key: 'fuel',        label: 'Fuel',           emoji: '⛽' },
  { key: 'bank_loan',   label: 'Bank Loan',      emoji: '🏦' },
  { key: 'other_fixed', label: 'Other (Fixed)',  emoji: '📋' },
]

export function FixedExpenses() {
  const existing = useLiveQuery(() => db.fixed_expense_config.toArray(), [])

  const [form, setForm] = useState({
    rent: '', salaries: '', electricity: '', water: '', fuel: '', bank_loan: '', other_fixed: '',
  })
  const [saved, setSaved] = useState(false)

  // Populate form when the DB record loads
  useEffect(() => {
    if (!existing) return
    const rec = existing[0]
    if (rec) {
      setForm({
        rent:        String(rec.rent ?? ''),
        salaries:    String(rec.salaries ?? ''),
        electricity: String(rec.electricity ?? ''),
        water:       String(rec.water ?? ''),
        fuel:        String(rec.fuel ?? ''),
        bank_loan:   String(rec.bank_loan ?? ''),
        other_fixed: String(rec.other_fixed ?? ''),
      })
    }
  }, [existing])

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const monthly = FIELDS.reduce((s, f) => s + (parseFloat(form[f.key]) || 0), 0)

  async function handleSave() {
    const existing0 = (await db.fixed_expense_config.toArray())[0]
    const record = {
      id:          existing0?.id ?? newId(),
      rent:        parseFloat(form.rent) || 0,
      salaries:    parseFloat(form.salaries) || 0,
      electricity: parseFloat(form.electricity) || 0,
      water:       parseFloat(form.water) || 0,
      fuel:        parseFloat(form.fuel) || 0,
      bank_loan:   parseFloat(form.bank_loan) || 0,
      other_fixed: parseFloat(form.other_fixed) || 0,
      updated_at:  nowIso(),
      synced:      0,
    }
    await db.fixed_expense_config.put(record)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const fmt = (n) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <Layout title="Fixed Monthly Expenses" showBack>
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-700">
            These amounts are automatically subtracted from profit in every monthly report.
            Set each to 0 if it doesn't apply.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {FIELDS.map(({ key, label, emoji }) => (
            <div key={key} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl w-8 text-center shrink-0">{emoji}</span>
              <label className="text-sm font-medium text-gray-700 w-28 shrink-0">{label}</label>
              <input
                type="number"
                min="0"
                step="any"
                className={`${inputCls} text-right`}
                placeholder="0"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Monthly total */}
        <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Total per month</span>
          <span className="text-lg font-bold text-gray-900">{fmt(monthly)}</span>
        </div>

        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
            <p className="text-green-700 font-semibold text-sm">Saved! These amounts will be applied to all reports.</p>
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full bg-blue-700 text-white font-bold rounded-xl py-3.5 text-base"
        >
          Save Configuration
        </button>
      </div>
    </Layout>
  )
}
