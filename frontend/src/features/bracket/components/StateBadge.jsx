export function StateBadge({ state }) {
  const active = state === 'active'

  return (
    <span
      className={`ml-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
        active ? 'bg-success/15 text-success' : 'bg-base-content/8 text-base-content/60'
      }`}
    >
      {active && <span className="bg-success h-1.5 w-1.5 animate-pulse rounded-full" />}
      {state}
    </span>
  )
}
