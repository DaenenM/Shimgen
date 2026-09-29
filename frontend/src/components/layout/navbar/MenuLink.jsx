import { Link } from 'react-router-dom'

// One row in AccountMenu.jsx's dropdown.
export function MenuLink({ to, label, icon: Icon, badge = 0 }) {
  return (
    <li>
      <Link
        to={to}
        className="hover:bg-primary/10 hover:text-primary flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 hover:pl-4"
      >
        {label}
        <span className="flex items-center gap-2">
          {badge > 0 && (
            <span className="bg-primary text-primary-content rounded-full px-1.5 py-0.5 text-xs font-bold">
              {badge}
            </span>
          )}
          {Icon && <Icon className="h-4 w-4 opacity-40" />}
        </span>
      </Link>
    </li>
  )
}
