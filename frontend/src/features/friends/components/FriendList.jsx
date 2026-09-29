import { Users } from '@/components/icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCards } from '@/components/ui/Skeleton'

import { PersonRow } from './PersonRow'

// Accepted friends list with a remove action. Used by FriendsPage.jsx.
export function FriendList({ friends, isLoading, remove }) {
  return (
    <>
      <h2 className="text-base-content/60 mb-2 text-xs font-semibold tracking-wide uppercase">
        Friends
      </h2>

      {isLoading ? (
        <SkeletonCards count={4} />
      ) : friends.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No friends yet"
          description="Add someone by their @username. Once they accept, their results follow them across every group you both play in."
        />
      ) : (
        <ul className="grid gap-2">
          {friends.map((item) => (
            // Friendship is stored directionally; "them" is whichever side isn't the sender.
            <PersonRow
              key={item.id}
              person={item.direction === 'outgoing' ? item.to_user : item.from_user}
            >
              <button
                className="text-error hover:bg-error/10 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors duration-150"
                onClick={() => remove.mutate(item.id)}
              >
                Remove
              </button>
            </PersonRow>
          ))}
        </ul>
      )}
    </>
  )
}
