import { Avatar } from '@/components/ui/Avatar'

// One row in a friends/requests list: avatar, name, handle, and actions.
// Used by FriendList.jsx, IncomingRequests.jsx, OutgoingRequests.jsx.
export function PersonRow({ person, children }) {
  return (
    <li className="glass-inset">
      <div className="flex flex-row items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={person.name || person.username} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{person.name}</p>
            <p className="text-base-content/50 truncate text-xs">@{person.username}</p>
          </div>
        </div>

        {children}
      </div>
    </li>
  )
}
