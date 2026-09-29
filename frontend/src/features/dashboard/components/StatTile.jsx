import { Link } from 'react-router-dom'

/**
 * One headline number, linking to the page behind it.
 *
 * `glass-inset` rather than `glass-panel`: these sit three across in a row of
 * small tiles, and a full panel's 20px blur plus drop shadow made them read as
 * three floating cards rather than one band of figures.
 */
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
