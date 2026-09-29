import { NavLink } from 'react-router-dom'

/**
 * One nav destination.
 *
 * Hover does exactly one thing: the label brightens and the underline grows in
 * from the centre. There used to be three effects at once — a grey box behind
 * the text, the icon hopping upward, and the underline sweeping in from the
 * left — which read as busy rather than polished, and the box in particular
 * made the bar look like a row of buttons.
 *
 * The underline is a scaled pseudo-element rather than an animated width or a
 * border: transform is the one property the compositor can animate without
 * re-laying-out the page.
 */
export function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-2 px-3.5 py-2 text-[0.9375rem] font-semibold',
          'transition-colors duration-200',
          // Idle lifted from /60 to /75: at 15px semibold the old tone read as
          // disabled rather than merely not-current.
          isActive ? 'text-primary' : 'text-base-content/75 hover:text-base-content',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-4.5 w-4.5" />
          {label}

          {/* Grown from the centre rather than swept from the left: a symmetric
              reveal reads as the item settling, where a left-to-right sweep
              reads as something loading. */}
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
