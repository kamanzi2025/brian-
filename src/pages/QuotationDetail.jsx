import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { convertQuotationToSale, saveQuotation } from '../db/operations'
import { Layout } from '../components/Layout'
import { fmt, nowIso } from '../utils/format'

const STATUS_LABELS = { draft: 'Draft', sent: 'Sent', converted: 'Converted', expired: 'Expired' }
const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  converted: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
}
const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'mobile_money', label: 'Mobile Money' },
  { key: 'credit', label: 'On Credit' },
]

export function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [converting, setConverting] = useState(false)
  const [convertPayMethod, setConvertPayMethod] = useState('cash')
  const [showConvertPanel, setShowConvertPanel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const quotation = useLiveQuery(() => db.quotations.get(id), [id])
  const items = useLiveQuery(
    () => db.quotation_items.where('quotation_id').equals(id).toArray(),
    [id]
  )
  const customer = useLiveQuery(
    () => (quotation?.customer_id ? db.customers.get(quotation.customer_id) : undefined),
    [quotation?.customer_id]
  )
  const products = useLiveQuery(() => db.products.toArray(), [])
  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]))

  if (quotation === undefined || items === undefined) {
    return (
      <Layout title="Quotation" showBack>
        <p className="text-center text-gray-400 py-10">Loading…</p>
      </Layout>
    )
  }

  if (!quotation) {
    return (
      <Layout title="Quotation" showBack>
        <p className="text-center text-gray-400 py-10">Quotation not found.</p>
      </Layout>
    )
  }

  async function handleMarkSent() {
    setBusy(true)
    setError(null)
    try {
      await saveQuotation({
        quotation: { ...quotation, status: 'sent', updated_at: nowIso(), synced: 0 },
        items,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleConvert() {
    setBusy(true)
    setError(null)
    try {
      const saleId = await convertQuotationToSale(id, { paymentMethod: convertPayMethod })
      navigate(`/sales/${saleId}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Layout title="Quotation" showBack>
      <div className="space-y-4 pb-4">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-800 text-lg">
                {customer?.name ?? 'Walk-in / No customer'}
              </p>
              <p className="text-sm text-gray-400 mt-0.5">{quotation.date}</p>
              {quotation.expiry_date && (
                <p className="text-xs text-gray-400">Expires: {quotation.expiry_date}</p>
              )}
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                STATUS_COLORS[quotation.status] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {STATUS_LABELS[quotation.status] ?? quotation.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-mono">{quotation.id}</p>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
            Items
          </p>
          {items.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6 px-4">No items.</p>
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
                    <p className="text-xs text-gray-400">{fmt(item.unit_price)} each</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-gray-600">× {item.quantity}</p>
                    <p className="font-bold text-gray-800">{fmt(item.subtotal)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{fmt(quotation.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>VAT (18%)</span>
            <span>{fmt(quotation.vat_amount)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100">
            <span>Total</span>
            <span className="text-lg">{fmt(quotation.total)}</span>
          </div>
        </div>

        {/* Notes */}
        {quotation.notes && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-600">{quotation.notes}</p>
          </div>
        )}

        {error && (
          <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{error}</p>
        )}

        {/* Actions */}
        {quotation.status === 'draft' && (
          <button
            onClick={handleMarkSent}
            disabled={busy}
            className="w-full border-2 border-blue-600 text-blue-700 font-semibold rounded-xl py-3 text-sm hover:bg-blue-50 disabled:opacity-40"
          >
            {busy ? 'Updating…' : 'Mark as Sent'}
          </button>
        )}

        {(quotation.status === 'draft' || quotation.status === 'sent') && (
          <>
            {showConvertPanel ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Select payment method</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setConvertPayMethod(key)}
                      className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                        convertPayMethod === key
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConvertPanel(false)}
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConvert}
                    disabled={busy}
                    className="flex-1 bg-green-600 text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-40 hover:bg-green-700"
                  >
                    {busy ? 'Converting…' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowConvertPanel(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl py-3 text-sm"
              >
                Convert to Sale
              </button>
            )}
          </>
        )}

        {quotation.status === 'converted' && quotation.converted_sale_id && (
          <button
            onClick={() => navigate(`/sales/${quotation.converted_sale_id}`)}
            className="w-full border border-green-300 text-green-700 font-semibold rounded-xl py-3 text-sm hover:bg-green-50"
          >
            View Converted Sale →
          </button>
        )}
      </div>
    </Layout>
  )
}
