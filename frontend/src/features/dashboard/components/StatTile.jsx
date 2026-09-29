import { Link } from 'react-router-dom'

// One headline stat linking to its page. Used by DashboardPage.jsx.
// glass-inset, not glass-panel: three of these sit in a row and the panel's
// blur/shadow made them read as separate cards instead of one band.
export function StatTile({ label, value, to }) {
  return (
    <Link
      to={to}
      className="glass-inset hover:border-base-content/25 hover:bg-base-content/5 px-4 py-3.5 transition-colors duration-200"
    >
      <p className="text-base-content/50 text-xs">{label}</p>
      <p className="tabular mt-0.5 text-2xl font-bold">{value}</p>
    </Link>
  )
}
