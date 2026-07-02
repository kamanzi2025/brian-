import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { fmt, today } from '../utils/format'

const METHOD_LABELS = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  credit: 'Credit',
}

export function SalesList() {
  const navigate = useNavigate()
  const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0] })()
  const [range, setRange] = useState({ from: defaultFrom, to: today() })
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')

  const sales = useLiveQuery(
    () =>
      db.sales
        .where('date')
        .between(range.from, range.to, true, true)
        .reverse()
        .sortBy('date')
        .then((rows) => rows.reverse()),
    [range.from, range.to]
  )

  const customers = useLiveQuery(() => db.customers.toArray(), [])
  const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c]))

  const filtered = (sales ?? []).filter((sale) => {
    if (sale.voided) return false
    if (methodFilter !== 'all' && sale.payment_method !== methodFilter) return false
    if (search.trim()) {
      const name = sale.customer_id && customerMap[sale.customer_id]
        ? customerMap[sale.customer_id].name
        : 'Walk-in customer'
      if (!name.toLowerCase().includes(search.toLowerCase())) return false
    }
    return true
  })

  const grandTotal = filtered.reduce((s, sale) => s + (sale.total ?? 0), 0)

  return (
    <Layout title="Sales" showBack>
      <div className="space-y-4 pb-4">
        {/* Date range */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </section>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer name…"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Payment method filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['all', 'cash', 'mobile_money', 'credit'].map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium border shrink-0 transition-colors ${
                methodFilter === m
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {m === 'all' ? 'All' : METHOD_LABELS[m] ?? m}
            </button>
          ))}
        </div>

        {/* Summary */}
        {filtered.length > 0 && (
          <div className="bg-blue-50 rounded-xl border border-blue-100 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-blue-700 font-medium">
              {filtered.length} sale{filtered.length !== 1 ? 's' : ''}
            </p>
            <p className="font-bold text-blue-900">{fmt(grandTotal)}</p>
          </div>
        )}

        {/* List */}
        {sales === undefined ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No sales match your filters.</p>
        ) : (
          filtered.map((sale) => {
            const customer = sale.customer_id ? customerMap[sale.customer_id] : null
            return (
              <button
                key={sale.id}
                onClick={() => navigate(`/sales/${sale.id}`)}
                className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:bg-gray-50 transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">
                      {customer?.name ?? 'Walk-in customer'}
                    </p>
                    <div className="flex gap-2 mt-0.5">
                      <p className="text-xs text-gray-400">{sale.date}</p>
                      <span className="text-xs text-gray-300">·</span>
                      <p className="text-xs text-gray-400">
                        {METHOD_LABELS[sale.payment_method] ?? sale.payment_method}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-800">{fmt(sale.total)}</p>
                    {(sale.vat_amount ?? 0) > 0 && (
                      <p className="text-xs text-gray-400">incl. VAT {fmt(sale.vat_amount)}</p>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </Layout>
  )
}
