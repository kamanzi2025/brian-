import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { fmt } from '../utils/format'

const METHOD_LABELS = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  card: 'Card',
  credit: 'Credit',
}

export function SaleDetail() {
  const { id } = useParams()

  const sale = useLiveQuery(() => db.sales.get(id), [id])
  const saleItems = useLiveQuery(
    () => db.sale_items.where('sale_id').equals(id).toArray(),
    [id]
  )
  const products = useLiveQuery(() => db.products.toArray(), [])
  const customers = useLiveQuery(() => db.customers.toArray(), [])

  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]))
  const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c.name]))

  if (!sale || !saleItems || !products || !customers) {
    return (
      <Layout title="Sale Detail" showBack>
        <p className="text-center text-gray-400 py-10">Loading…</p>
      </Layout>
    )
  }

  const customerName = sale.customer_id && customerMap[sale.customer_id]
    ? customerMap[sale.customer_id]
    : 'Walk-in customer'

  const subtotal = sale.subtotal ?? saleItems.reduce((s, i) => s + i.subtotal, 0)
  const vatAmount = sale.vat_amount ?? 0
  const total = sale.total ?? subtotal + vatAmount

  return (
    <Layout title="Sale Detail" showBack>
      <div className="space-y-4 pb-4">

        {/* ── Header info ─────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Customer</span>
            <span className="font-semibold text-gray-800">{customerName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Date</span>
            <span className="text-gray-700">{sale.date}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Payment</span>
            <span className="text-gray-700">{METHOD_LABELS[sale.payment_method] ?? sale.payment_method}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Status</span>
            <span className={`font-semibold ${sale.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
              {sale.status}
            </span>
          </div>
        </section>

        {/* ── Line items ──────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
            Items Sold
          </p>
          {saleItems.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No items recorded.</p>
          ) : (
            saleItems.map((item) => {
              const product = productMap[item.product_id]
              return (
                <div key={item.id} className="px-4 py-3 border-t border-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">
                        {product?.name ?? 'Unknown product'}
                      </p>
                      {product?.sku && (
                        <p className="text-xs text-gray-400">SKU: {product.sku}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.quantity} × {fmt(item.unit_price)}
                      </p>
                    </div>
                    <p className="font-bold text-gray-800 shrink-0">{fmt(item.subtotal)}</p>
                  </div>
                </div>
              )
            })
          )}
        </section>

        {/* ── Totals ──────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>VAT (18%)</span>
            <span>{fmt(vatAmount)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="font-bold text-gray-800">Total</span>
            <span className="text-xl font-bold text-gray-800">{fmt(total)}</span>
          </div>
        </section>

      </div>
    </Layout>
  )
}
