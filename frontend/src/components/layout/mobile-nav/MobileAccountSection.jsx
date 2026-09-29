import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/useAuth'
import { paths } from '@/routes/paths'

const SIGNED_IN = [
  { to: paths.dashboard, label: 'Dashboard' },
  { to: paths.roster, label: 'My roster' },
  { to: paths.friends, label: 'Friends' },
  { to: paths.profile, label: 'Profile' },
]

const SIGNED_OUT = [
  { to: paths.login, label: 'Log in' },
  { to: paths.register, label: 'Create an account' },
]

// Account half of the phone menu sheet. Used by MobileMenu.jsx.
export function MobileAccountSection({ onNavigate }) {
  const { isAuthenticated, user, logout } = useAuth()
  const links = isAuthenticated ? SIGNED_IN : SIGNED_OUT

  return (
    <div className="border-base-content/10 border-t p-2">
      <p className="text-base-content/45 px-3 pt-1 pb-1.5 text-xs font-semibold tracking-wide uppercase">
        {isAuthenticated ? (user?.name ?? 'Account') : 'Account'}
      </p>

      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          onClick={onNavigate}
          className="hover:bg-base-content/8 flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors"
        >
          {link.label}
        </Link>
      ))}

      {isAuthenticated && (
        <button
          type="button"
          onClick={() => {
            onNavigate()
            logout()
          }}
          className="text-error hover:bg-error/10 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium transition-colors"
        >
          Log out
        </button>
      )}
    </div>
  )
}
