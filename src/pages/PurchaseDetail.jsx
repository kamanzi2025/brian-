import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { fmt } from '../utils/format'

const STATUS_LABELS = { paid: 'Paid', unpaid: 'Unpaid', partial: 'Partial' }
const STATUS_COLORS = {
  paid: 'bg-green-100 text-green-700',
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-700',
}

export function PurchaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const purchase = useLiveQuery(() => db.purchases.get(id), [id])
  const items = useLiveQuery(
    () => db.purchase_items.where('purchase_id').equals(id).toArray(),
    [id]
  )
  const supplier = useLiveQuery(
    () => (purchase?.supplier_id ? db.suppliers.get(purchase.supplier_id) : undefined),
    [purchase?.supplier_id]
  )
  const products = useLiveQuery(() => db.products.toArray(), [])
  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]))

  if (purchase === undefined || items === undefined) {
    return (
      <Layout title="Purchase" showBack>
        <p className="text-center text-gray-400 py-10">Loading…</p>
      </Layout>
    )
  }

  if (!purchase) {
    return (
      <Layout title="Purchase" showBack>
        <p className="text-center text-gray-400 py-10">Purchase not found.</p>
      </Layout>
    )
  }

  return (
    <Layout title="Purchase Detail" showBack>
      <div className="space-y-4 pb-4">
        {/* Header card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-800 text-lg">
                {supplier?.name ?? 'Unknown supplier'}
              </p>
              <p className="text-sm text-gray-400 mt-0.5">{purchase.date}</p>
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                STATUS_COLORS[purchase.payment_status] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {STATUS_LABELS[purchase.payment_status] ?? purchase.payment_status}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-mono">{purchase.id}</p>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
            Items Received
          </p>
          {items.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6 px-4">No items recorded.</p>
          ) : (
            items.map((item) => {
              const product = productMap[item.product_id]
              return (
                <div
                  key={item.id}
                  className="px-4 py-3 border-t border-gray-50 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {product?.name ?? 'Unknown product'}
                    </p>
                    {product?.sku && (
                      <p className="text-xs text-gray-400">SKU: {product.sku}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-gray-800">
                      {item.quantity} × {fmt(item.unit_cost)}
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {fmt(item.quantity * item.unit_cost)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Total */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
          <p className="font-semibold text-gray-700">Total</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(purchase.total)}</p>
        </div>

        {/* Supplier balance */}
        {supplier && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
            <p className="text-xs text-yellow-700 font-medium">
              Current balance owed to {supplier.name}:{' '}
              <span className="font-bold">{fmt(supplier.balance_owed ?? 0)}</span>
            </p>
          </div>
        )}

        {/* Record payment shortcut */}
        {purchase.payment_status !== 'paid' && (
          <button
            onClick={() => navigate('/payments/new')}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl py-3 text-sm"
          >
            Record Payment to Supplier
          </button>
        )}
      </div>
    </Layout>
  )
}
