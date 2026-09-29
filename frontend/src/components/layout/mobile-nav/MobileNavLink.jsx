import { NavLink } from 'react-router-dom'

// One destination row in the phone menu sheet. Used by MobileMenu.jsx.
export function MobileNavLink({ to, label, icon: Icon, end, hint, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      // Closed on click directly, not via an effect watching the route.
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
          isActive ? 'bg-primary/12 text-primary' : 'hover:bg-base-content/8'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
              isActive ? 'bg-primary/15' : 'bg-base-content/8 text-base-content/60'
            }`}
          >
            <Icon className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] font-semibold">{label}</span>
            <span className="text-base-content/50 block truncate text-xs">{hint}</span>
          </span>
        </>
      )}
    </NavLink>
  )
}
