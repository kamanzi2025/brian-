import { useLiveQuery } from 'dexie-react-hooks'
import { computeAPAging } from '../../reports/compute'
import { fmt } from '../../utils/format'
import { AgingView } from './ARAging'

export function APAging() {
  const data = useLiveQuery(() => computeAPAging(), [])

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (data.total === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-3xl mb-2">✅</p>
        <p className="font-medium text-gray-600">No outstanding supplier balances</p>
        <p className="text-sm mt-1">All supplier invoices are paid.</p>
      </div>
    )
  }

  return (
    <AgingView
      data={data}
      entityLabel="Supplier"
      balanceLabel="Owe them"
      dateLabel="Oldest unpaid purchase"
    />
  )
}
