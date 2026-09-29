import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { PageHeader } from '@/components/ui/PageHeader'
import { AddFriendForm } from '@/features/friends/components/AddFriendForm'
import { FriendList } from '@/features/friends/components/FriendList'
import { IncomingRequests } from '@/features/friends/components/IncomingRequests'
import { OutgoingRequests } from '@/features/friends/components/OutgoingRequests'
import { useFriends } from '@/features/friends/hooks/useFriends'

// Friends list and requests. Route: /friends
// Linking accounts gives stats continuity across different hosts' events.
export function FriendsPage() {
  const { isLoading, friends, incoming, outgoing, connectedIds, request, accept, remove } =
    useFriends()

  return (
    <div className="glass-backdrop mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        className="rise-in rise-delay-1"
        title="Friends"
        description="Add someone by their @username. Linking accounts keeps everyone's stats together across whoever is hosting."
      />

      <AddFriendForm request={request} connectedIds={connectedIds} />
      <ErrorAlert className="mb-4">{request.error?.message}</ErrorAlert>

      <IncomingRequests requests={incoming} accept={accept} remove={remove} />
      <OutgoingRequests requests={outgoing} remove={remove} />
      <FriendList friends={friends} isLoading={isLoading} remove={remove} />
    </div>
  )
}
