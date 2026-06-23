import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'

function ActionCard({ emoji, label, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-left hover:shadow-md active:bg-gray-50 transition-shadow"
    >
      <span className="text-3xl w-10 text-center shrink-0">{emoji}</span>
      <div>
        <p className="font-semibold text-gray-800">{label}</p>
        <p className="text-sm text-gray-400 mt-0.5">{description}</p>
      </div>
      <svg className="w-5 h-5 text-gray-300 ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

export function More() {
  const navigate = useNavigate()

  const customerCount = useLiveQuery(() => db.customers.count(), [])
  const supplierCount = useLiveQuery(() => db.suppliers.count(), [])

  return (
    <Layout title="More">
      <div className="space-y-6">

        {/* Quick actions */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Quick Actions
          </p>
          <div className="space-y-2">
            <ActionCard
              emoji="💸"
              label="Add Expense"
              description="Record rent, salaries, utilities, etc."
              onClick={() => navigate('/expenses/new')}
            />
            <ActionCard
              emoji="💰"
              label="Record Payment"
              description="Log a payment from a customer or to a supplier"
              onClick={() => navigate('/payments/new')}
            />
          </div>
        </section>

        {/* Transactions */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Transactions
          </p>
          <div className="space-y-2">
            <ActionCard
              emoji="🧾"
              label="Sales History"
              description="Browse all sales with filters and date range"
              onClick={() => navigate('/sales')}
            />
            <ActionCard
              emoji="🚚"
              label="Purchase History"
              description="View purchases by date, status, and supplier"
              onClick={() => navigate('/purchases')}
            />
            <ActionCard
              emoji="💸"
              label="Expense History"
              description="View all expenses by category and date"
              onClick={() => navigate('/expenses')}
            />
            <ActionCard
              emoji="💳"
              label="Payment History"
              description="All incoming and outgoing payments"
              onClick={() => navigate('/payments')}
            />
            <ActionCard
              emoji="📋"
              label="Quotations"
              description="Create and convert price quotes"
              onClick={() => navigate('/quotations')}
            />
            <ActionCard
              emoji="↩️"
              label="Returns"
              description="Process customer returns and restock items"
              onClick={() => navigate('/returns')}
            />
          </div>
        </section>

        {/* Reports */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Reports
          </p>
          <ActionCard
            emoji="📊"
            label="Financial Reports"
            description="P&L, Balance Sheet, Cash Flow, Inventory, AR/AP Aging, By Part, By Category"
            onClick={() => navigate('/reports')}
          />
        </section>

        {/* Data management */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Data
          </p>
          <div className="space-y-2">
            <ActionCard
              emoji="👤"
              label={`Customers (${customerCount ?? '…'})`}
              description="Add or manage customer accounts and credit"
              onClick={() => navigate('/customers')}
            />
            <ActionCard
              emoji="🏭"
              label={`Suppliers (${supplierCount ?? '…'})`}
              description="Add or manage suppliers and balances"
              onClick={() => navigate('/suppliers')}
            />
          </div>
        </section>
      </div>
    </Layout>
  )
}
