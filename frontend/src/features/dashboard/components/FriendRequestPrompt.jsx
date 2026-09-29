import { Link } from 'react-router-dom'

import { UserPlus } from '@/components/icons'
import { paths } from '@/routes/paths'

/**
 * A pending friend request is the one thing on the dashboard that needs an
 * answer, so it gets a prompt rather than sitting silently in a counter.
 */
export function FriendRequestPrompt({ count, className = '' }) {
  if (count === 0) return null

  return (
    <Link
      to={paths.friends}
      className={`glass-inset hover:border-base-content/25 hover:bg-base-content/5 flex items-center gap-2.5 px-4 py-3 text-sm transition-colors duration-200 ${className}`}
    >
      <UserPlus className="text-primary h-4 w-4 shrink-0" />
      <span>
        You have {count} pending friend {count === 1 ? 'request' : 'requests'}.
      </span>
    </Link>
  )
}
