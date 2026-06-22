import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { fmt, today } from '../utils/format'

const STATUS_LABELS = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  partial: 'Partial',
}

const STATUS_COLORS = {
  paid: 'bg-green-100 text-green-700',
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-700',
}

export function PurchaseList() {
  const navigate = useNavigate()
  const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0] })()
  const [range, setRange] = useState({ from: defaultFrom, to: today() })
  const [statusFilter, setStatusFilter] = useState('all')

  const purchases = useLiveQuery(
    () =>
      db.purchases
        .where('date')
        .between(range.from, range.to, true, true)
        .reverse()
        .sortBy('date')
        .then((rows) => rows.reverse()),
    [range.from, range.to]
  )

  const suppliers = useLiveQuery(() => db.suppliers.toArray(), [])
  const supplierMap = Object.fromEntries((suppliers ?? []).map((s) => [s.id, s.name]))

  const filtered =
    statusFilter === 'all'
      ? (purchases ?? [])
      : (purchases ?? []).filter((p) => p.payment_status === statusFilter)

  const grandTotal = filtered.reduce((s, p) => s + (p.total ?? 0), 0)

  return (
    <Layout title="Purchases" showBack>
      <div className="space-y-4 pb-4">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </section>

        {/* Status filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['all', 'paid', 'unpaid', 'partial'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border shrink-0 transition-colors ${
                statusFilter === s
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Summary */}
        {filtered.length > 0 && (
          <div className="bg-blue-50 rounded-xl border border-blue-100 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-blue-700 font-medium">{filtered.length} purchase{filtered.length !== 1 ? 's' : ''}</p>
            <p className="font-bold text-blue-900">{fmt(grandTotal)}</p>
          </div>
        )}

        {/* List */}
        {purchases === undefined ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No purchases in this period.</p>
        ) : (
          filtered.map((purchase) => (
            <button
              key={purchase.id}
              onClick={() => navigate(`/purchases/${purchase.id}`)}
              className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:bg-gray-50 transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {purchase.supplier_id && supplierMap[purchase.supplier_id]
                      ? supplierMap[purchase.supplier_id]
                      : 'Unknown supplier'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{purchase.date}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="font-bold text-gray-800">{fmt(purchase.total)}</p>
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[purchase.payment_status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {STATUS_LABELS[purchase.payment_status] ?? purchase.payment_status}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </Layout>
  )
}
