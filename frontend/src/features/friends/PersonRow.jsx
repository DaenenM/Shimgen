import { Avatar } from '@/components/ui/Avatar'

/**
 * A user in a friends list: avatar, display name, handle, and the row's
 * actions on the right.
 */
export function PersonRow({ person, children }) {
  return (
    <li className="glass-inset">
      <div className="flex flex-row items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={person.name || person.username} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{person.name}</p>
            {/* The handle under the name, quieter than it: the name is who they
                are, the handle is how they are addressed. */}
            <p className="text-base-content/50 truncate text-xs">@{person.username}</p>
          </div>
        </div>

        {children}
      </div>
    </li>
  )
}
