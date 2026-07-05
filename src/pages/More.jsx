import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'

const ALL_TABLES = [
  'products', 'customers', 'suppliers',
  'sales', 'sale_items',
  'purchases', 'purchase_items',
  'expenses', 'payments',
  'quotations', 'quotation_items',
  'returns', 'return_items',
  'stock_movements', 'supplier_tabs', 'fixed_expense_config',
]

async function exportData() {
  const snapshot = {}
  for (const t of ALL_TABLES) {
    try { snapshot[t] = await db[t].toArray() } catch { snapshot[t] = [] }
  }
  const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data: snapshot }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `autoparts-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importData(file) {
  const text = await file.text()
  const parsed = JSON.parse(text)
  const data = parsed.data ?? parsed // support both wrapped and raw formats
  let total = 0
  for (const t of ALL_TABLES) {
    const rows = data[t]
    if (!Array.isArray(rows) || rows.length === 0) continue
    try {
      await db[t].bulkPut(rows)
      total += rows.length
    } catch { /* skip tables that don't exist in this schema version */ }
  }
  return total
}

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
  const fileInputRef = useRef(null)
  const [importStatus, setImportStatus] = useState(null) // null | 'loading' | {ok, msg}

  const customerCount = useLiveQuery(() => db.customers.count(), [])
  const supplierCount = useLiveQuery(() => db.suppliers.count(), [])

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportStatus('loading')
    try {
      const total = await importData(file)
      setImportStatus({ ok: true, msg: `Imported ${total} records successfully.` })
    } catch (err) {
      setImportStatus({ ok: false, msg: `Import failed: ${err.message}` })
    }
  }

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

        {/* Settings */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Settings
          </p>
          <ActionCard
            emoji="📋"
            label="Fixed Monthly Expenses"
            description="Configure recurring costs: rent, salaries, utilities, bank loans"
            onClick={() => navigate('/fixed-expenses')}
          />
        </section>

        {/* Backup & Restore */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Backup &amp; Restore
          </p>
          <div className="space-y-2">
            <ActionCard
              emoji="⬇️"
              label="Export Data"
              description="Download all your data as a JSON backup file"
              onClick={exportData}
            />
            <ActionCard
              emoji="⬆️"
              label="Import Data"
              description="Restore data from a backup file (e.g. from old GitHub Pages version)"
              onClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            {importStatus === 'loading' && (
              <p className="text-sm text-blue-600 px-1">Importing…</p>
            )}
            {importStatus && importStatus !== 'loading' && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${importStatus.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {importStatus.msg}
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  )
}
