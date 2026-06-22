import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { fmt, today } from '../utils/format'

export function ReturnsList() {
  const navigate = useNavigate()
  const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0] })()
  const [range, setRange] = useState({ from: defaultFrom, to: today() })

  const returns = useLiveQuery(
    () =>
      db.returns
        .where('date')
        .between(range.from, range.to, true, true)
        .reverse()
        .sortBy('date')
        .then((rows) => rows.reverse()),
    [range.from, range.to]
  )

  const totalReturned = (returns ?? []).reduce((s, r) => s + (r.total ?? 0), 0)

  return (
    <Layout title="Returns" showBack>
      <div className="space-y-4 pb-4">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </section>

        {(returns ?? []).length > 0 && (
          <div className="bg-orange-50 rounded-xl border border-orange-100 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-orange-700 font-medium">
              {returns.length} return{returns.length !== 1 ? 's' : ''}
            </p>
            <p className="font-bold text-orange-900">{fmt(totalReturned)}</p>
          </div>
        )}

        {returns === undefined ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : returns.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No returns in this period.</p>
        ) : (
          returns.map((ret) => (
            <div
              key={ret.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {ret.reason || 'Return'}
                  </p>
                  <div className="flex gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">{ret.date}</p>
                    {ret.original_sale_id && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <button
                          onClick={() => navigate(`/sales/${ret.original_sale_id}`)}
                          className="text-xs text-blue-600 underline"
                        >
                          Sale #{ret.original_sale_id.slice(0, 8).toUpperCase()}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="font-bold text-orange-700 shrink-0">{fmt(ret.total)}</p>
              </div>
            </div>
          ))
        )}

        <button
          onClick={() => navigate('/returns/new')}
          className="w-full border-2 border-dashed border-blue-300 text-blue-600 rounded-xl py-3 text-sm font-semibold hover:bg-blue-50"
        >
          + New Return
        </button>
      </div>
    </Layout>
  )
}
