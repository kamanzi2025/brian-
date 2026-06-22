import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { fmt } from '../utils/format'

const STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  converted: 'Converted',
  expired: 'Expired',
}

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  converted: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
}

export function QuotationList() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('all')

  const quotations = useLiveQuery(
    () => db.quotations.orderBy('date').reverse().toArray(),
    []
  )
  const customers = useLiveQuery(() => db.customers.toArray(), [])
  const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c.name]))

  const filtered =
    statusFilter === 'all'
      ? (quotations ?? [])
      : (quotations ?? []).filter((q) => q.status === statusFilter)

  return (
    <Layout title="Quotations" showBack>
      <div className="space-y-4 pb-4">
        {/* Status filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['all', 'draft', 'sent', 'converted', 'expired'].map((s) => (
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

        {/* List */}
        {quotations === undefined ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No quotations found.</p>
        ) : (
          filtered.map((q) => (
            <button
              key={q.id}
              onClick={() => navigate(`/quotations/${q.id}`)}
              className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:bg-gray-50 transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {q.customer_id && customerMap[q.customer_id]
                      ? customerMap[q.customer_id]
                      : 'Walk-in / No customer'}
                  </p>
                  <div className="flex gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">{q.date}</p>
                    {q.expiry_date && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <p className="text-xs text-gray-400">Expires {q.expiry_date}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="font-bold text-gray-800">{fmt(q.total)}</p>
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[q.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {STATUS_LABELS[q.status] ?? q.status}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}

        <button
          onClick={() => navigate('/quotations/new')}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl py-3 text-sm"
        >
          + New Quotation
        </button>
      </div>
    </Layout>
  )
}
