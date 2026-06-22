import { today } from '../utils/format'

/**
 * DateRangeFilter — compact two-input date picker with quick-select pills.
 *
 * Props:
 *   from       {string}   ISO date string  (controlled)
 *   to         {string}   ISO date string  (controlled)
 *   onChange   {function} called with ({ from, to }) on every change
 */
export function DateRangeFilter({ from, to, onChange }) {
  const set = (key, value) => onChange({ from, to, [key]: value })

  const presets = [
    {
      label: 'Today',
      get() {
        const t = today()
        return { from: t, to: t }
      },
    },
    {
      label: 'This week',
      get() {
        const now = new Date()
        const day = now.getDay()
        const mon = new Date(now)
        mon.setDate(now.getDate() - ((day + 6) % 7))
        return { from: mon.toISOString().split('T')[0], to: today() }
      },
    },
    {
      label: 'This month',
      get() {
        const now = new Date()
        const first = new Date(now.getFullYear(), now.getMonth(), 1)
        return { from: first.toISOString().split('T')[0], to: today() }
      },
    },
    {
      label: 'Last 30d',
      get() {
        const d = new Date()
        d.setDate(d.getDate() - 29)
        return { from: d.toISOString().split('T')[0], to: today() }
      },
    },
  ]

  const activePreset = presets.find((p) => {
    const { from: f, to: t } = p.get()
    return f === from && t === to
  })?.label

  return (
    <div className="space-y-2">
      {/* Quick-select pills */}
      <div className="flex gap-2 flex-wrap">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(p.get())}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              activePreset === p.label
                ? 'bg-blue-700 border-blue-700 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Manual date inputs */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => set('from', e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400 text-sm">–</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => set('to', e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}
