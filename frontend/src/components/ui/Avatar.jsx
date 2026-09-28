/**
 * A person's single-initial avatar.
 *
 * A single initial rather than a generated avatar image: no network request,
 * no layout shift, and it still gives a row a recognisable anchor. One letter
 * rather than two — at 32px a two-letter pair is set small enough to read as a
 * smudge, where one glyph fills the square and stays legible.
 *
 * Shared so a person looks the same in the account menu, search results and
 * the friends list.
 */
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
