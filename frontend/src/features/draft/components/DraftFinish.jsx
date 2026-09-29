import { Check, Shuffle } from '@/components/icons'
import { Button } from '@/components/ui/Button'

/**
 * The end of the draft.
 *
 * Confirmation rather than auto-generating on the final pick: the last tap of a
 * draft is the one most likely to be a misclick, and building the bracket is
 * not undoable from here.
 *
 * Host only. Completing the draft creates the entrants and generates the
 * bracket — `draft_complete` is gated on IsTournamentHost, so for anybody else
 * the button was an action that could only fail. Everyone else gets the state
 * instead of the control.
 */
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
    // Green because it is the one moment in the draft that is simply good news:
    // every team is settled and the bracket is moments away. The redirect fires
    // on its own when the host builds it, so this says "wait" without asking
    // anyone to do anything.
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
