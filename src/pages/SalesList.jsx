import { useNavigate } from 'react-router-dom'
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

export function SalesList() {
  const navigate = useNavigate()

  const sales = useLiveQuery(() => db.sales.orderBy('date').reverse().toArray(), [])
  const customers = useLiveQuery(() => db.customers.toArray(), [])

  const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c.name]))

  return (
    <Layout title="Sales" showBack>
      <div className="space-y-3">
        {sales === undefined ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : sales.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No sales yet.</p>
        ) : (
          sales.map((sale) => (
            <button
              key={sale.id}
              onClick={() => navigate(`/sales/${sale.id}`)}
              className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:bg-gray-50 transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">
                    {sale.customer_id && customerMap[sale.customer_id]
                      ? customerMap[sale.customer_id]
                      : 'Walk-in customer'}
                  </p>
                  <div className="flex gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">{sale.date}</p>
                    <span className="text-xs text-gray-300">·</span>
                    <p className="text-xs text-gray-400">{METHOD_LABELS[sale.payment_method] ?? sale.payment_method}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-800">{fmt(sale.total)}</p>
                  {sale.vat_amount > 0 && (
                    <p className="text-xs text-gray-400">incl. VAT {fmt(sale.vat_amount)}</p>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </Layout>
  )
}
