import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { fmt, today } from '../utils/format'

const SYNCED_TABLES = [
  'products', 'customers', 'suppliers', 'sales', 'expenses', 'payments',
  'purchases', 'quotations', 'returns', 'stock_movements',
]

export function Home() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const todayStr = today()

  // Today's revenue (non-voided sales today)
  const todayRevenue = useLiveQuery(
    () =>
      db.sales
        .where('date')
        .equals(todayStr)
        .filter((s) => !s.voided && s.status !== 'cancelled')
        .toArray()
        .then((rows) => rows.reduce((s, r) => s + (r.subtotal ?? ((r.total ?? 0) - (r.vat_amount ?? 0))), 0)),
    [todayStr]
  )

  // Gross margin % (last 30 days) — uses cost_price on sale_items with product fallback
  const grossMargin = useLiveQuery(async () => {
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0] })()
    const sales = await db.sales
      .where('date').aboveOrEqual(cutoff)
      .filter((s) => !s.voided && s.status !== 'cancelled')
      .toArray()
    if (sales.length === 0) return null
    const saleIds = sales.map((s) => s.id)
    const items = await db.sale_items.where('sale_id').anyOf(saleIds).toArray()
    const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))]
    const products = productIds.length > 0
      ? await db.products.where('id').anyOf(productIds).toArray()
      : []
    const pMap = new Map(products.map((p) => [p.id, p]))
    let revenue = 0
    let cogs = 0
    for (const item of items) {
      revenue += item.quantity * (item.unit_price ?? 0)
      const cost = (item.cost_price && item.cost_price > 0)
        ? item.cost_price
        : (pMap.get(item.product_id)?.cost_price ?? 0)
      cogs += item.quantity * cost
    }
    return revenue > 0 ? ((revenue - cogs) / revenue) * 100 : null
  }, [])

  // Outstanding receivables
  const outstanding = useLiveQuery(
    () => db.customers.toArray().then((rows) => rows.reduce((s, c) => s + (c.balance_owed ?? 0), 0)),
    []
  )

  // Low-stock items sorted by urgency (most below reorder level first)
  const lowStockItems = useLiveQuery(
    () =>
      db.products
        .filter(
          (p) =>
            (p.reorder_level ?? 0) > 0 &&
            (p.qty_store ?? 0) + (p.qty_warehouse ?? 0) <= (p.reorder_level ?? 0)
        )
        .toArray()
        .then((rows) =>
          rows.sort(
            (a, b) =>
              (a.qty_store + a.qty_warehouse) / (a.reorder_level || 1) -
              (b.qty_store + b.qty_warehouse) / (b.reorder_level || 1)
          )
        ),
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
  const productCount = useLiveQuery(() => db.products.count(), [])
  const customerCount = useLiveQuery(() => db.customers.count(), [])
  const saleCount = useLiveQuery(() => db.sales.count(), [])

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

        {/* Today KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Today's Revenue</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(todayRevenue ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Gross Margin</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">
              {grossMargin != null ? `${grossMargin.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-gray-400">last 30 days</p>
          </div>
        </div>

        {/* Receivables */}
        {(outstanding ?? 0) > 0 && (
          <button
            onClick={() => navigate('/reports')}
            className="w-full bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-left"
          >
            <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide">Outstanding Receivables</p>
            <p className="text-xl font-bold text-orange-800 mt-0.5">{fmt(outstanding ?? 0)}</p>
          </button>
        )}

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

        {/* Low stock alert — sorted by urgency */}
        {(lowStockItems ?? []).length > 0 && (
          <button
            onClick={() => navigate('/products')}
            className="w-full bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-left"
          >
            <p className="text-sm font-semibold text-yellow-800 mb-1">
              {lowStockItems.length} product{lowStockItems.length !== 1 ? 's' : ''} running low
            </p>
            {lowStockItems.slice(0, 3).map((p) => (
              <p key={p.id} className="text-xs text-yellow-700">
                {p.name} — {(p.qty_store ?? 0) + (p.qty_warehouse ?? 0)} left (reorder at {p.reorder_level})
              </p>
            ))}
            {lowStockItems.length > 3 && (
              <p className="text-xs text-yellow-600 mt-0.5">
                +{lowStockItems.length - 3} more — tap to view
              </p>
            )}
          </button>
        )}

        {/* Quick nav grid */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Sale', emoji: '🧾', path: '/sales/new', highlight: true },
              { label: 'New Quotation', emoji: '📋', path: '/quotations/new' },
              { label: 'New Purchase', emoji: '🚚', path: '/purchases/new' },
              { label: 'Add Expense', emoji: '💸', path: '/expenses/new' },
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
