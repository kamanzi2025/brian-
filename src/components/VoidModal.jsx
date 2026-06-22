import { useState } from 'react'

/**
 * VoidModal — confirms intent before voiding a sale.
 *
 * Props:
 *   saleId     {string}    id of the sale to void
 *   onConfirm  {function}  called with (saleId, reason) string when user confirms
 *   onClose    {function}  called when user cancels
 */
export function VoidModal({ saleId, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = reason.trim().length >= 3 && !busy

  async function handleConfirm() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(saleId, reason.trim())
      // onConfirm navigates away — no need to call onClose
    } catch (err) {
      setError(err.message ?? 'Failed to void sale.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Void this sale?</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Stock will be returned and the record will be marked as void.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer returned, duplicate entry…"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          {reason.trim().length > 0 && reason.trim().length < 3 && (
            <p className="text-xs text-red-500 mt-1">Reason must be at least 3 characters.</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-red-700"
          >
            {busy ? 'Voiding…' : 'Yes, Void Sale'}
          </button>
        </div>
      </div>
    </div>
  )
}
