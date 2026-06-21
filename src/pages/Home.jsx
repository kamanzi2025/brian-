import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { fmt } from '../utils/format'

const SYNCED_TABLES = ['products', 'customers', 'suppliers', 'sales', 'expenses', 'payments']

export function Home() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const productCount = useLiveQuery(() => db.products.count(), [])
  const lowStockCount = useLiveQuery(
    () => db.products.filter((p) => (p.reorder_level ?? 0) > 0 && (p.quantity_on_hand ?? 0) <= (p.reorder_level ?? 0)).count(),
    []
  )
  const customerCount = useLiveQuery(() => db.customers.count(), [])
  const saleCount = useLiveQuery(() => db.sales.count(), [])
  const totalSales = useLiveQuery(() =>
    db.sales.toArray().then((rows) => rows.reduce((s, r) => s + (r.total ?? 0), 0)),
    []
  )
  const unsyncedCount = useLiveQuery(
    () =>
      Promise.all(SYNCED_TABLES.map((t) => db[t].where('synced').equals(0).count())).then(
        (counts) => counts.reduce((a, b) => a + b, 0)
      ),
    []
  )

  const signOutAction = (
    <button onClick={signOut} className="text-white/70 hover:text-white text-sm underline">
      Sign out
    </button>
  )

  return (
    <Layout action={signOutAction}>
      <div className="space-y-5">
        {/* Unsynced warning */}
        {unsyncedCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
            <span className="font-semibold">{unsyncedCount}</span> change{unsyncedCount !== 1 ? 's' : ''} not yet synced — will upload when online.
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Sales</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(totalSales ?? 0)}</p>
          </div>
          <div
            className={`rounded-xl border shadow-sm p-4 ${
              (lowStockCount ?? 0) > 0
                ? 'bg-yellow-50 border-yellow-200 cursor-pointer'
                : 'bg-white border-gray-100'
            }`}
            onClick={() => lowStockCount > 0 && navigate('/products')}
          >
            <p className="text-xs text-gray-400 uppercase tracking-wide">Low Stock</p>
            <p className={`text-2xl font-bold mt-1 ${(lowStockCount ?? 0) > 0 ? 'text-yellow-700' : 'text-gray-800'}`}>
              {lowStockCount ?? '…'}
            </p>
            {(lowStockCount ?? 0) > 0 && (
              <p className="text-xs text-yellow-600 mt-0.5">Tap to view →</p>
            )}
          </div>
        </div>

        {/* Quick nav grid */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Sale', emoji: '🧾', path: '/sales/new', highlight: true },
              { label: 'New Purchase', emoji: '🚚', path: '/purchases/new' },
              { label: 'Add Expense', emoji: '💸', path: '/expenses/new' },
              { label: 'Record Payment', emoji: '💰', path: '/payments/new' },
            ].map(({ label, emoji, path, highlight }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex items-center gap-3 rounded-xl p-4 shadow-sm text-left border transition-shadow hover:shadow-md active:scale-95 ${
                  highlight
                    ? 'bg-blue-700 border-blue-700 text-white'
                    : 'bg-white border-gray-100 text-gray-700'
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="font-semibold text-sm">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Stats row */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { label: 'Products', value: productCount ?? '…', path: '/products' },
            { label: 'Customers', value: customerCount ?? '…', path: '/customers' },
            { label: 'Sales', value: saleCount ?? '…', path: null },
          ].map(({ label, value, path }) => (
            <button
              key={label}
              onClick={() => path && navigate(path)}
              disabled={!path}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center hover:shadow-md disabled:cursor-default"
            >
              <p className="text-xl font-bold text-gray-800">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </button>
          ))}
        </section>
      </div>
    </Layout>
  )
}
