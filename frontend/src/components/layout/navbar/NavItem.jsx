import { NavLink } from 'react-router-dom'

// One nav destination in Navbar.jsx. Underline uses a scaled element (not
// width/border) so the compositor can animate it without a layout pass.
export function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-2 px-3.5 py-2 text-[0.9375rem] font-semibold',
          'transition-colors duration-200',
          isActive ? 'text-primary' : 'text-base-content/75 hover:text-base-content',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-4.5 w-4.5" />
          {label}

          {/* Grows from centre rather than sweeping left-to-right. */}
          <span
            aria-hidden
            className={`bg-primary absolute inset-x-2.5 bottom-0 h-[2.5px] origin-center rounded-full transition-transform duration-300 ease-out ${
              isActive
                ? 'shadow-primary/60 scale-x-100 shadow-[0_0_8px_0_var(--color-primary)]'
                : 'scale-x-0 group-hover:scale-x-100'
            }`}
          />
        </>
      )}
    </NavLink>
  )
}
