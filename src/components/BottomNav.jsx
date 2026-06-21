import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Home', icon: HomeIcon, exact: true },
  { to: '/products', label: 'Stock', icon: BoxIcon },
  { to: '/sales/new', label: 'New Sale', icon: PlusIcon, primary: true },
  { to: '/purchases/new', label: 'Purchase', icon: TruckIcon },
  { to: '/more', label: 'More', icon: DotsIcon },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex safe-bottom">
      {tabs.map(({ to, label, icon: Icon, primary, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[11px] font-medium transition-colors ${
              primary
                ? isActive
                  ? 'text-white'
                  : 'text-white'
                : isActive
                ? 'text-blue-700'
                : 'text-gray-500'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {primary ? (
                <span className="w-12 h-12 -mt-5 mb-0.5 rounded-full bg-blue-700 shadow-lg flex items-center justify-center">
                  <Icon active={true} />
                </span>
              ) : (
                <Icon active={isActive} />
              )}
              <span className={primary ? 'text-gray-500' : ''}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

// ─── Icons (inline SVG keeps the bundle tight) ───────────────────────────────

function HomeIcon({ active }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'text-blue-700' : 'text-gray-400'}`}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"
      />
    </svg>
  )
}

function BoxIcon({ active }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'text-blue-700' : 'text-gray-400'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7l-8-4-8 4m16 0v10l-8 4m-8-4V7m8 4v10M4 7l8 4 8-4"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function TruckIcon({ active }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'text-blue-700' : 'text-gray-400'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m0 0h2m-2 0h10m0 0h2m-2 0a2 2 0 104 0m-4 0a2 2 0 11-4 0m4 0H7m0 0a2 2 0 10-4 0"
      />
    </svg>
  )
}

function DotsIcon({ active }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'text-blue-700' : 'text-gray-400'}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}
