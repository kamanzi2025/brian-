import { fmt } from '../utils/format'

/**
 * InvoicePrint — printable/shareable A4 invoice overlay.
 *
 * Props:
 *   sale            sale record (id, date, payment_method, subtotal, vat_amount, total, voided,
 *                               salesman_name, delivery_address)
 *   items           [{ product_name, quantity, unit_price, subtotal }]
 *   customer        customer record or null (walk-in)
 *   onClose         closes the overlay
 */
export function InvoicePrint({ sale, items, customer, onClose }) {
  const businessName = 'AutoParts Manager'

  function buildText() {
    const lines = []
    lines.push(businessName)
    lines.push('─'.repeat(36))
    lines.push(`Invoice: ${sale.id.slice(0, 8).toUpperCase()}`)
    lines.push(`Date:    ${sale.date}`)
    if (customer) lines.push(`To:      ${customer.name}`)
    if (sale.salesman_name) lines.push(`Sales:   ${sale.salesman_name}`)
    if (sale.delivery_address) lines.push(`Deliver: ${sale.delivery_address}`)
    lines.push('─'.repeat(36))
    items.forEach((item) => {
      lines.push(`${item.product_name}`)
      lines.push(`  ${item.quantity} x ${fmt(item.unit_price)} = ${fmt(item.subtotal)}`)
    })
    lines.push('─'.repeat(36))
    lines.push(`Subtotal:  ${fmt(sale.subtotal)}`)
    lines.push(`VAT (18%): ${fmt(sale.vat_amount)}`)
    lines.push(`TOTAL:     ${fmt(sale.total)}`)
    lines.push('─'.repeat(36))
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
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body > *:not(#invoice-print-root) { display: none !important; }
          #invoice-print-root {
            display: block !important;
            position: static !important;
            background: white !important;
          }
          .no-print { display: none !important; }
          .invoice-body {
            max-width: 100% !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div
        id="invoice-print-root"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      >
        <div className="invoice-body bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
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
            </div>

            {/* Customer / Salesman / Delivery */}
            <div className="border border-gray-100 rounded-xl px-3 py-2.5 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Customer</span>
                <span className="font-semibold text-gray-800">{customer?.name ?? 'Walk-in'}</span>
              </div>
              {sale.salesman_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Salesman</span>
                  <span className="text-gray-700">{sale.salesman_name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Date</span>
                <span className="text-gray-700">{sale.date}</span>
              </div>
              {sale.delivery_address && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 shrink-0">Deliver to</span>
                  <span className="text-gray-700 text-right ml-2">{sale.delivery_address}</span>
                </div>
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
                <span className="col-span-5">Description</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Price</span>
                <span className="col-span-3 text-right">Total</span>
              </div>
              {items.map((item, i) => (
                <div
                  key={i}
                  className="px-3 py-2 grid grid-cols-12 text-sm border-t border-gray-50 items-center"
                >
                  <span className="col-span-5 text-gray-800 truncate pr-1">{item.product_name}</span>
                  <span className="col-span-2 text-center text-gray-500">{item.quantity}</span>
                  <span className="col-span-2 text-right text-gray-500">{fmt(item.unit_price)}</span>
                  <span className="col-span-3 text-right font-medium text-gray-800">
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
                Print A4
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
