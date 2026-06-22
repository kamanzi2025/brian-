import { fmt } from '../utils/format'

/**
 * InvoicePrint — renders a printable/shareable invoice view.
 *
 * Props:
 *   sale       {object}  sale record (id, date, payment_method, subtotal, vat_amount, total, voided)
 *   items      {array}   sale_items joined with product name: [{ product_name, quantity, unit_price, subtotal }]
 *   customer   {object|null}  customer record or null for walk-in
 *   onClose    {function}  closes the overlay
 *
 * Printing: Clicking "Print" calls window.print(). The component injects a
 *   <style> that hides everything except the invoice when the media is print.
 *   Sharing via WhatsApp / Email builds a plain-text invoice string.
 */
export function InvoicePrint({ sale, items, customer, onClose }) {
  const businessName = 'AutoParts Manager'

  // Build plain-text version for sharing
  function buildText() {
    const lines = []
    lines.push(businessName)
    lines.push('─'.repeat(32))
    lines.push(`Invoice: ${sale.id.slice(0, 8).toUpperCase()}`)
    lines.push(`Date:    ${sale.date}`)
    if (customer) lines.push(`To:      ${customer.name}`)
    lines.push('─'.repeat(32))
    items.forEach((item) => {
      lines.push(`${item.product_name}`)
      lines.push(`  ${item.quantity} x ${fmt(item.unit_price)} = ${fmt(item.subtotal)}`)
    })
    lines.push('─'.repeat(32))
    lines.push(`Subtotal:  ${fmt(sale.subtotal)}`)
    lines.push(`VAT (18%): ${fmt(sale.vat_amount)}`)
    lines.push(`TOTAL:     ${fmt(sale.total)}`)
    lines.push('─'.repeat(32))
    lines.push(`Payment:   ${sale.payment_method?.replace('_', ' ') ?? '—'}`)
    if (sale.voided) lines.push('** VOID **')
    return lines.join('\n')
  }

  const encodedText = encodeURIComponent(buildText())

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {/* Inject print media styles */}
      <style>{`
        @media print {
          body > *:not(#invoice-print-root) { display: none !important; }
          #invoice-print-root { display: block !important; position: static !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        id="invoice-print-root"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      >
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
          {/* Header */}
          <div className="bg-blue-700 text-white px-5 py-4 no-print flex items-center justify-between">
            <p className="font-semibold">Invoice</p>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">
              ×
            </button>
          </div>

          {/* Invoice body */}
          <div className="px-5 py-4 space-y-4">
            {/* Business + meta */}
            <div>
              <p className="text-lg font-bold text-gray-900">{businessName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Invoice #{sale.id.slice(0, 8).toUpperCase()} · {sale.date}
              </p>
              {customer && (
                <p className="text-sm text-gray-600 mt-1">To: {customer.name}</p>
              )}
            </div>

            {sale.voided && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
                <p className="text-red-700 font-bold text-sm tracking-widest">VOID</p>
              </div>
            )}

            {/* Line items */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 grid grid-cols-12 text-xs font-medium text-gray-500">
                <span className="col-span-6">Item</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Price</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              {items.map((item, i) => (
                <div
                  key={i}
                  className="px-3 py-2 grid grid-cols-12 text-sm border-t border-gray-50 items-center"
                >
                  <span className="col-span-6 text-gray-800 truncate pr-1">{item.product_name}</span>
                  <span className="col-span-2 text-center text-gray-500">{item.quantity}</span>
                  <span className="col-span-2 text-right text-gray-500">{fmt(item.unit_price)}</span>
                  <span className="col-span-2 text-right font-medium text-gray-800">
                    {fmt(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{fmt(sale.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>VAT (18%)</span>
                <span>{fmt(sale.vat_amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100">
                <span>Total</span>
                <span className="text-lg">{fmt(sale.total)}</span>
              </div>
              <p className="text-xs text-gray-400 capitalize">
                Payment: {sale.payment_method?.replace('_', ' ') ?? '—'}
              </p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 no-print pt-1">
              <button
                onClick={handlePrint}
                className="flex flex-col items-center gap-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium"
              >
                <span className="text-lg">🖨️</span>
                Print
              </button>
              <a
                href={`https://wa.me/?text=${encodedText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium"
              >
                <span className="text-lg">💬</span>
                WhatsApp
              </a>
              <a
                href={`mailto:?subject=Invoice ${sale.id.slice(0, 8).toUpperCase()}&body=${encodedText}`}
                className="flex flex-col items-center gap-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium"
              >
                <span className="text-lg">✉️</span>
                Email
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
