import { useLiveQuery } from 'dexie-react-hooks'
import { computeBalanceSheet } from '../../reports/compute'
import { fmt } from '../../utils/format'

function BSRow({ label, value, indent, bold, separator, negative }) {
  if (separator) return <div className="border-t border-gray-200 my-1.5" />
  const display = negative && value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)
  return (
    <div
      className={`flex justify-between items-baseline py-1 ${indent ? 'pl-4' : ''} ${
        bold ? 'border-t border-gray-100 mt-0.5 pt-1.5' : ''
      }`}
    >
      <span className={`text-sm ${bold ? 'font-bold text-gray-800' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`text-sm tabular-nums ${bold ? 'font-bold text-gray-800' : 'text-gray-700'}`}>
        {display}
      </span>
    </div>
  )
}

export function BalanceSheet() {
  const data = useLiveQuery(() => computeBalanceSheet(), [])

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}
      </div>
    )
  }

  const { assets, liabilities, equity } = data

  return (
    <div className="space-y-4">
      {/* Equity summary pill */}
      <div
        className={`rounded-xl p-4 text-center ${
          equity >= 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
        }`}
      >
        <p className={`text-xs font-semibold uppercase tracking-wide ${equity >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          Owner's Equity
        </p>
        <p
          className={`text-3xl font-bold mt-1 tabular-nums ${
            equity >= 0 ? 'text-green-700' : 'text-red-600'
          }`}
        >
          {fmt(equity)}
        </p>
        <p className="text-xs text-gray-400 mt-1">Assets − Liabilities</p>
      </div>

      {/* Assets */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Assets
        </p>
        <BSRow
          label="Cash on Hand (est.)"
          value={assets.cashOnHand}
          negative={assets.cashOnHand < 0}
          indent
        />
        <BSRow label="Inventory Value" value={assets.inventoryValue} indent />
        <BSRow label="Accounts Receivable" value={assets.accountsReceivable} indent />
        <BSRow separator />
        <BSRow label="Total Assets" value={assets.total} bold />
        <p className="text-xs text-gray-400 mt-3 leading-relaxed">
          Cash is estimated from recorded transactions. Negative cash indicates more outflows are
          recorded than inflows — check for missing receipts.
        </p>
      </section>

      {/* Liabilities */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Liabilities
        </p>
        <BSRow label="Accounts Payable (suppliers)" value={liabilities.accountsPayable} indent />
        <BSRow separator />
        <BSRow label="Total Liabilities" value={liabilities.total} bold />
      </section>

      {/* Equity detail */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Equity
        </p>
        <BSRow label="Total Assets" value={assets.total} indent />
        <BSRow label="Total Liabilities" value={liabilities.total} negative indent />
        <BSRow separator />
        <BSRow label="Owner's Equity" value={equity} bold />
      </section>

      <p className="text-xs text-gray-400 text-center pb-2">
        This is a snapshot based on all recorded data — not filtered by date.
      </p>
    </div>
  )
}
