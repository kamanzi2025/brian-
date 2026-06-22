import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { fmt, today } from '../utils/format'

export function ExpenseList() {
  const navigate = useNavigate()
  const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0] })()
  const [range, setRange] = useState({ from: defaultFrom, to: today() })
  const [categoryFilter, setCategoryFilter] = useState('')

  const expenses = useLiveQuery(
    () =>
      db.expenses
        .where('date')
        .between(range.from, range.to, true, true)
        .reverse()
        .sortBy('date')
        .then((rows) => rows.reverse()),
    [range.from, range.to]
  )

  const allCategories = useLiveQuery(
    () => db.expenses.orderBy('category').uniqueKeys(),
    []
  )

  const filtered =
    categoryFilter
      ? (expenses ?? []).filter((e) => e.category === categoryFilter)
      : (expenses ?? [])

  const total = filtered.reduce((s, e) => s + (e.amount ?? 0), 0)

  return (
    <Layout title="Expenses" showBack>
      <div className="space-y-4 pb-4">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </section>

        {/* Category filter pills */}
        {(allCategories ?? []).length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-3 py-1 rounded-full text-xs font-medium border shrink-0 transition-colors ${
                !categoryFilter
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              All
            </button>
            {(allCategories ?? []).filter(Boolean).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium border shrink-0 transition-colors ${
                  categoryFilter === cat
                    ? 'bg-blue-700 border-blue-700 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Summary */}
        {filtered.length > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-100 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-700 font-medium">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</p>
            <p className="font-bold text-red-900">{fmt(total)}</p>
          </div>
        )}

        {/* List */}
        {expenses === undefined ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No expenses in this period.</p>
        ) : (
          filtered.map((expense) => (
            <div
              key={expense.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {expense.description || expense.category || 'Expense'}
                  </p>
                  <div className="flex gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">{expense.date}</p>
                    {expense.category && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{expense.category}</span>
                      </>
                    )}
                  </div>
                </div>
                <p className="font-bold text-gray-800 shrink-0">{fmt(expense.amount)}</p>
              </div>
            </div>
          ))
        )}

        <button
          onClick={() => navigate('/expenses/new')}
          className="w-full border-2 border-dashed border-blue-300 text-blue-600 rounded-xl py-3 text-sm font-semibold hover:bg-blue-50"
        >
          + Add Expense
        </button>
      </div>
    </Layout>
  )
}
