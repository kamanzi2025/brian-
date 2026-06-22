import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { fmt, today } from '../utils/format'

const METHOD_LABELS = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  card: 'Card',
  bank: 'Bank',
}

export function PaymentList() {
  const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0] })()
  const [range, setRange] = useState({ from: defaultFrom, to: today() })
  const [dirFilter, setDirFilter] = useState('all')

  const payments = useLiveQuery(
    () =>
      db.payments
        .where('date')
        .between(range.from, range.to, true, true)
        .reverse()
        .sortBy('date')
        .then((rows) => rows.reverse()),
    [range.from, range.to]
  )

  const filtered =
    dirFilter === 'all'
      ? (payments ?? [])
      : (payments ?? []).filter((p) => p.direction === dirFilter)

  const totalIn = (payments ?? []).filter((p) => p.direction === 'in').reduce((s, p) => s + (p.amount ?? 0), 0)
  const totalOut = (payments ?? []).filter((p) => p.direction === 'out').reduce((s, p) => s + (p.amount ?? 0), 0)

  return (
    <Layout title="Payments" showBack>
      <div className="space-y-4 pb-4">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </section>

        {/* Direction summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-xl border border-green-100 p-3">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Received</p>
            <p className="text-lg font-bold text-green-800 mt-0.5">{fmt(totalIn)}</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-100 p-3">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Paid Out</p>
            <p className="text-lg font-bold text-red-800 mt-0.5">{fmt(totalOut)}</p>
          </div>
        </div>

        {/* Direction filter */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'in', label: 'Received' },
            { key: 'out', label: 'Paid out' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDirFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                dirFilter === key
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        {payments === undefined ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No payments in this period.</p>
        ) : (
          filtered.map((payment) => (
            <div
              key={payment.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        payment.direction === 'in'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {payment.direction === 'in' ? '↓ In' : '↑ Out'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {METHOD_LABELS[payment.method] ?? payment.method ?? 'Cash'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{payment.date}</p>
                  {payment.note && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{payment.note}</p>
                  )}
                </div>
                <p className={`font-bold text-lg shrink-0 ${
                  payment.direction === 'in' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {payment.direction === 'out' ? '−' : '+'}{fmt(payment.amount)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}
