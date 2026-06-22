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
    () => db.products.filter((p) => (p.reorder_level ?? 0) > 0 && ((p.qty_warehouse ?? 0) + (p.qty_store ?? 0)) <= (p.reorder_level ?? 0)).count(),
    []
  )
  const storeTotal = useLiveQuery(
    () => db.products.toArray().then((rows) => rows.reduce((s, p) => s + (p.qty_store ?? 0), 0)),
    []
  )
  const warehouseTotal = useLiveQuery(
    () => db.products.toArray().then((rows) => rows.reduce((s, p) => s + (p.qty_warehouse ?? 0), 0)),
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Sales</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(totalSales ?? 0)}</p>
        </div>

        {/* Stock by location */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="bg-blue-50 rounded-xl border border-blue-100 shadow-sm p-4 cursor-pointer active:scale-95 transition-transform"
            onClick={() => navigate('/products')}
          >
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Store Stock</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{storeTotal ?? '…'}</p>
            <p className="text-xs text-blue-400 mt-0.5">units at store</p>
          </div>
          <div
            className="bg-amber-50 rounded-xl border border-amber-100 shadow-sm p-4 cursor-pointer active:scale-95 transition-transform"
            onClick={() => navigate('/products')}
          >
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide">Warehouse</p>
            <p className="text-3xl font-bold text-amber-700 mt-1">{warehouseTotal ?? '…'}</p>
            <p className="text-xs text-amber-400 mt-0.5">units in warehouse</p>
          </div>
        </div>

        {/* Low stock alert */}
        {(lowStockCount ?? 0) > 0 && (
          <button
            onClick={() => navigate('/products')}
            className="w-full bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-left"
          >
            <p className="text-sm font-semibold text-yellow-800">
              {lowStockCount} product{lowStockCount !== 1 ? 's' : ''} running low — tap to view
            </p>
          </button>
        )}

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
            { label: 'Sales', value: saleCount ?? '…', path: '/sales' },
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
