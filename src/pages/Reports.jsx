import { useState } from 'react'
import { Layout } from '../components/Layout'
import { PRESETS, getPresetRange } from '../reports/dateHelpers'
import { today } from '../utils/format'
import { PLReport } from './report-tabs/PLReport'
import { BalanceSheet } from './report-tabs/BalanceSheet'
import { CashFlow } from './report-tabs/CashFlow'
import { InventoryReport } from './report-tabs/InventoryReport'
const TABS = [
  { key: 'pl', label: 'P & L', usesDate: true },
  { key: 'balance', label: 'Balance Sheet', usesDate: false },
  { key: 'cashflow', label: 'Cash Flow', usesDate: true },
  { key: 'inventory', label: 'Inventory', usesDate: false },
]

export function Reports() {
  const [tab, setTab] = useState('pl')
  const [preset, setPreset] = useState('this_month')
  const [customFrom, setCustomFrom] = useState(today())
  const [customTo, setCustomTo] = useState(today())

  const activeTab = TABS.find((t) => t.key === tab)
  const { from, to } =
    preset === 'custom' ? { from: customFrom, to: customTo } : getPresetRange(preset)

  return (
    <Layout title="Reports" showBack>
      {/* ── Tab bar ──────────────────────────────────────── */}
      <div className="flex overflow-x-auto gap-1 -mx-4 px-4 pb-1 mb-3 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'bg-blue-700 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Date range picker (only for date-filtered tabs) ── */}
      {activeTab?.usesDate && (
        <div className="mb-4 space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  preset === p.key
                    ? 'bg-gray-700 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">To</label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          )}

          {preset !== 'custom' && (
            <p className="text-xs text-gray-400 text-center">
              {from} → {to}
            </p>
          )}
        </div>
      )}

      {/* ── Report content ───────────────────────────────── */}
      {tab === 'pl' && <PLReport from={from} to={to} />}
      {tab === 'balance' && <BalanceSheet />}
      {tab === 'cashflow' && <CashFlow from={from} to={to} />}
      {tab === 'inventory' && <InventoryReport />}
    </Layout>
  )
}
