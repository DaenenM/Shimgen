import { Link } from 'react-router-dom'

// One link group in the footer. Used by Footer.jsx.
export function FooterColumn({ title, links }) {
  return (
    <div>
      <h3 className="text-base-content mb-3 text-sm font-semibold">{title}</h3>

      <ul className="space-y-2">
        {links.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              // Colour only, matching the nav — no hover box.
              className="hover:text-primary inline-flex items-center gap-2 text-sm transition-colors duration-150"
            >
              {Icon && <Icon className="h-4 w-4 opacity-50" />}
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
