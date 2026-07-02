import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { openSupplierTab, closeSupplierTab } from '../db/operations'
import { Layout } from '../components/Layout'
import { fmt, nowIso } from '../utils/format'

const inputCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

const METHOD_LABELS = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  alipay: 'AliPay',
  bank: 'Bank Transfer',
}

function Badge({ children, color = 'gray' }) {
  const cls = {
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
  }[color]
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>
  )
}

export function SupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'tabs' | 'payments'
  const [proofModal, setProofModal] = useState(null)

  const supplier = useLiveQuery(() => db.suppliers.get(id), [id])
  const tabs = useLiveQuery(
    () => db.supplier_tabs.where('supplier_id').equals(id).reverse().sortBy('opened_at'),
    [id]
  )
  const purchases = useLiveQuery(
    () => db.purchases.where('supplier_id').equals(id).reverse().sortBy('date'),
    [id]
  )
  const payments = useLiveQuery(
    () => db.payments.where('supplier_id').equals(id).reverse().sortBy('date'),
    [id]
  )

  if (supplier === undefined) {
    return (
      <Layout title="Supplier" showBack>
        <p className="text-center text-gray-400 py-10">Loading…</p>
      </Layout>
    )
  }
  if (!supplier) {
    return (
      <Layout title="Supplier" showBack>
        <p className="text-center text-gray-400 py-10">Supplier not found.</p>
      </Layout>
    )
  }

  const paidInFull = (supplier.balance_owed ?? 0) === 0

  async function handleOpenTab() {
    await openSupplierTab(id)
  }

  async function handleCloseTab(tabId) {
    await closeSupplierTab(tabId)
  }

  const tabNav = ['overview', 'tabs', 'payments']
  const tabLabel = { overview: 'Overview', tabs: 'Purchase Tabs', payments: 'Payments' }

  return (
    <Layout title={supplier.name} showBack>
      {/* Balance banner */}
      <div
        className={`rounded-xl px-4 py-3 mb-4 flex items-center justify-between ${
          paidInFull
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}
      >
        <div>
          <p className={`text-xs font-semibold ${paidInFull ? 'text-green-600' : 'text-yellow-600'}`}>
            Balance Owed
          </p>
          <p className={`text-2xl font-bold ${paidInFull ? 'text-green-700' : 'text-yellow-700'}`}>
            {fmt(supplier.balance_owed ?? 0)}
          </p>
        </div>
        {paidInFull && (
          <span className="text-2xl">✅</span>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-4">
        {tabNav.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === t
                ? 'bg-blue-700 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {[
              ['Phone', supplier.phone],
              ['Email', supplier.email],
              ['Address', supplier.address],
              ['Payment Terms', supplier.payment_terms],
              ['Notes', supplier.notes],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-gray-800 font-medium text-right max-w-[60%]">{value}</span>
                </div>
              ))}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400">Total Purchases</p>
              <p className="text-xl font-bold text-gray-800">{(purchases ?? []).length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400">Total Paid</p>
              <p className="text-xl font-bold text-gray-800">
                {fmt(
                  (payments ?? [])
                    .filter((p) => p.direction === 'out')
                    .reduce((s, p) => s + (p.amount ?? 0), 0)
                )}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/payments/new', { state: { supplierId: id } })}
            className="w-full bg-blue-700 text-white font-bold rounded-xl py-3"
          >
            Record Payment to Supplier
          </button>
        </div>
      )}

      {/* ── PURCHASE TABS ── */}
      {activeTab === 'tabs' && (
        <div className="space-y-3">
          <button
            onClick={handleOpenTab}
            className="w-full border-2 border-dashed border-blue-300 text-blue-600 font-semibold rounded-xl py-3 text-sm hover:bg-blue-50"
          >
            + Open New Purchase Tab
          </button>

          {(tabs ?? []).length === 0 && (
            <p className="text-center text-gray-400 py-6 text-sm">No purchase tabs yet.</p>
          )}

          {(tabs ?? []).map((tab) => {
            const tabPurchases = (purchases ?? []).filter((p) => p.tab_id === tab.id)
            const tabTotal = tabPurchases.reduce((s, p) => s + (p.total ?? 0), 0)
            const isOpen = tab.status === 'open'
            return (
              <div
                key={tab.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 text-sm">
                        Tab opened {tab.opened_at?.slice(0, 10)}
                      </p>
                      <Badge color={isOpen ? 'blue' : 'gray'}>{isOpen ? 'Open' : 'Closed'}</Badge>
                    </div>
                    {tab.closed_at && (
                      <p className="text-xs text-gray-400">Closed {tab.closed_at.slice(0, 10)}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">{fmt(tabTotal)}</p>
                    <p className="text-xs text-gray-400">{tabPurchases.length} purchase{tabPurchases.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {tabPurchases.length > 0 && (
                  <div className="divide-y divide-gray-50">
                    {tabPurchases.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => navigate(`/purchases/${p.id}`)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-700">{p.date}</p>
                            <p className="text-xs text-gray-400 capitalize">{p.payment_status}</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-800">{fmt(p.total ?? 0)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {isOpen && (
                  <div className="px-4 py-3 border-t border-gray-50">
                    <button
                      onClick={() => handleCloseTab(tab.id)}
                      className="text-sm text-red-500 font-medium hover:underline"
                    >
                      Close this tab
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── PAYMENTS ── */}
      {activeTab === 'payments' && (
        <div className="space-y-3">
          {(payments ?? []).length === 0 && (
            <p className="text-center text-gray-400 py-6 text-sm">No payments recorded yet.</p>
          )}

          {(payments ?? []).map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{fmt(p.amount ?? 0)}</p>
                      <Badge color={p.direction === 'in' ? 'green' : 'yellow'}>
                        {p.direction === 'in' ? 'Received' : 'Paid out'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.date} · {METHOD_LABELS[p.method] ?? p.method}
                    </p>
                    {p.recipient_name && (
                      <p className="text-xs text-gray-500 mt-0.5">To: {p.recipient_name}</p>
                    )}
                    {p.rmb_amount > 0 && (
                      <p className="text-xs text-gray-400">
                        ¥{p.rmb_amount?.toLocaleString()} @ {p.exchange_rate}
                      </p>
                    )}
                    {p.note && <p className="text-xs text-gray-400 mt-0.5">{p.note}</p>}
                  </div>
                  {p.proof_image && (
                    <button
                      onClick={() => setProofModal(p.proof_image)}
                      className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-gray-200 hover:opacity-80"
                    >
                      <img src={p.proof_image} alt="Proof" className="w-full h-full object-cover" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proof image modal */}
      {proofModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setProofModal(null)}
        >
          <img
            src={proofModal}
            alt="Payment proof"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
        </div>
      )}
    </Layout>
  )
}
