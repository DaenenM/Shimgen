import { Check, Shuffle } from '@/components/icons'
import { Button } from '@/components/ui/Button'

// End-of-draft control/status. Used by DraftLobbyPage.jsx.
// Requires an explicit confirm (not auto-build) since the bracket build isn't undoable.
// Host-only button; everyone else sees status text since `draft_complete` is host-gated server-side.
export function DraftFinish({ isHost, ready, picksRemaining, complete }) {
  if (isHost) {
    return (
      <Button
        icon={ready ? Check : Shuffle}
        onClick={() => complete.mutate()}
        disabled={!ready || complete.isPending}
        loading={complete.isPending}
      >
        {ready ? 'Build the bracket' : `${picksRemaining} picks to go`}
      </Button>
    )
  }

  if (ready) {
    // Redirect fires automatically once the host builds it; this is just the wait state.
    return (
      <div className="border-success/30 bg-success/10 flex items-start gap-3 rounded-xl border p-4">
        <span className="bg-success/15 text-success grid h-9 w-9 shrink-0 place-items-center rounded-full">
          <Check className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-success text-sm font-semibold">Draft complete</p>
          <p className="text-base-content/60 mt-0.5 text-sm">
            Every player has a team. The bracket opens here as soon as the host builds it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <p className="text-base-content/50 text-sm">
      {picksRemaining} {picksRemaining === 1 ? 'pick' : 'picks'} to go.
    </p>
  )
}
