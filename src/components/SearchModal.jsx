import { useState, useEffect, useRef } from 'react'

/**
 * Reusable full-screen search modal — used for product picker, customer picker,
 * supplier picker.  Slides up from bottom on mobile, centred card on desktop.
 *
 * Props
 *   isOpen        boolean
 *   onClose       () => void
 *   title         string
 *   placeholder   string
 *   items         array — full list (filtering is done here client-side)
 *   searchKeys    string[] — which object fields to match on
 *   renderItem    (item) => JSX
 *   onSelect      (item) => void — called then modal auto-closes
 *   emptyMessage  string
 */
export function SearchModal({
  isOpen,
  onClose,
  title,
  placeholder = 'Search…',
  items = [],
  searchKeys = ['name'],
  renderItem,
  onSelect,
  emptyMessage = 'No results found',
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  // Clear query and focus input each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      // Small delay so the DOM is visible before we focus
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  if (!isOpen) return null

  const q = query.toLowerCase()
  const filtered = q
    ? items.filter((item) =>
        searchKeys.some((key) => String(item[key] ?? '').toLowerCase().includes(q))
      )
    : items

  function handleSelect(item) {
    onSelect(item)
    onClose()
  }

  return (
    // Dark overlay — tap outside to close
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[88vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <p className="flex-1 font-bold text-gray-800">{title}</p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3 border-b shrink-0">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Scrollable results */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">{emptyMessage}</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                className="w-full text-left px-4 py-3.5 hover:bg-blue-50 active:bg-blue-100 border-b border-gray-50 last:border-0"
                onClick={() => handleSelect(item)}
              >
                {renderItem(item)}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
