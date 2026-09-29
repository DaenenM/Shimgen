// Single-initial avatar badge. Shared UI primitive used wherever a person
// needs a visual anchor (account menu, search results, friends list).
export function Avatar({ name, className = '' }) {
  const initial = (name || '?').trim().slice(0, 1).toUpperCase() || '?'

  return (
    <span
      aria-hidden="true"
      className={`from-primary to-secondary text-primary-content grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-xs font-bold ${className}`}
    >
      {initial}
    </span>
  )
}
