import { useQuery } from '@tanstack/react-query'

import { friends as friendsApi } from '@/api/endpoints'
import { ChevronDown, LogOut, Users } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

import { MenuLink } from './MenuLink'

export function AccountMenu({ user, onLogout }) {
  // Friend requests are only visible on a page nobody opens speculatively, so
  // the nav has to be what says one arrived. Polled on a slow interval rather
  // than pushed: a request is not urgent, and this costs one small query.
  const { data: pending } = useQuery({
    queryKey: queryKeys.friends.pending,
    queryFn: friendsApi.pending,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  const waiting = pending?.length ?? 0

  return (
    <div className="dropdown dropdown-end">
      <button
        tabIndex={0}
        className="group text-base-content/70 hover:text-base-content flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-1.5 transition-colors duration-200"
        aria-label="Account menu"
      >
        <span className="relative">
          <Avatar name={user?.display_name || user?.username} />
          {/* A dot rather than a number: the menu below carries the count, and
              this only has to say "there is something in here". */}
          {waiting > 0 && (
            <span
              className="bg-primary border-base-100 absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
              aria-label={`${waiting} friend request${waiting === 1 ? '' : 's'} waiting`}
            />
          )}
        </span>
        <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
          {user?.display_name || user?.username}
        </span>
        <ChevronDown className="text-base-content/40 h-4 w-4 transition-transform duration-200 group-focus-within:rotate-180" />
      </button>

      <ul tabIndex={0} className="dropdown-content glass-raised z-40 mt-2 w-56 p-1.5">
        <li className="border-base-content/10 mb-1 border-b px-3 py-2">
          <p className="truncate text-sm font-semibold">{user?.display_name || user?.username}</p>
          <p className="text-base-content/50 truncate text-xs">{user?.email}</p>
        </li>

        <MenuLink to={paths.dashboard} label="Dashboard" />
        <MenuLink to={paths.roster} label="My Roster" />
        <MenuLink to={paths.savedTeams} label="Saved Teams" />
        <MenuLink to={paths.friends} label="Friends" icon={Users} badge={waiting} />
        <MenuLink to={paths.profile} label="Profile" />

        <li className="border-base-content/10 mt-1 border-t pt-1">
          <button
            onClick={onLogout}
            className="text-error hover:bg-error/10 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-150 hover:pl-4"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </li>
      </ul>
    </div>
  )
}
