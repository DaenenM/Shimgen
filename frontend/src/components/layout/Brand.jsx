import { Link } from 'react-router-dom'

import { Trophy } from '@/components/icons'
import { paths } from '@/routes/paths'

// Wordmark shared by Navbar.jsx and MobileNav.jsx.
// `compact` is the phone bar's smaller size (3rem vs 4.25rem height).
export function Brand({ compact = false, onClick }) {
  return (
    <Link
      to={paths.home}
      onClick={onClick}
      className={`group flex shrink-0 items-center gap-2 font-extrabold tracking-tight ${
        compact ? 'text-base' : 'rounded-lg px-2 py-1.5 text-xl'
      }`}
    >
      <span
        className={`bg-primary/15 text-primary grid place-items-center rounded-lg transition-transform duration-300 ease-out group-hover:scale-105 ${
          compact ? 'h-7 w-7' : 'h-8 w-8'
        }`}
      >
        <Trophy className={compact ? 'h-4 w-4' : 'h-4.5 w-4.5'} />
      </span>
      <span>
        shim<span className="text-primary">gen</span>
      </span>
    </Link>
  )
}
