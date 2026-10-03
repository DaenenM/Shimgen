// A round's coloured heading ("Semifinal"), one card wide. Used by RoundHeadings.jsx and DoubleEliminationLayout.jsx.
export function RoundPill({ label, tone, size }) {
  return (
    <h4 className={`${size.card} shrink-0 text-center`}>
      <span
        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide whitespace-nowrap uppercase"
        style={{ color: tone.color, backgroundColor: tone.wash }}
      >
        {label}
      </span>
    </h4>
  )
}
