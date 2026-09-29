import { CopyLinkButton } from '@/components/ui/CopyLinkButton'

/** The lobby's title, whose turn it is, and the link to share it. */
export function DraftHeader({ tournament, draft, current, ready, lobbyUrl, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {tournament?.title || 'Team draft'}
        </h1>

        {/* The turn indicator is the most important thing on the page: with
            one device being passed around, whoever is holding it needs to
            know at a glance whether it is their turn. */}
        <p className="text-base-content/60 mt-1 text-sm">
          {ready ? (
            <>Every player has a team. Review the sides below, then build the bracket.</>
          ) : (
            <>
              <span className="text-primary font-semibold">{current?.captain_label}</span> picks —{' '}
              {draft.picks_remaining} left
            </>
          )}
        </p>
      </div>

      {/* A friend added to the pool has no way of knowing until their own
          browser asks again, so handing them the link beats telling them to
          go and look. */}
      <CopyLinkButton
        url={lobbyUrl}
        label="Share lobby"
        title="Copy a link to this lobby for the people in the draft"
        className="shrink-0"
      />
    </div>
  )
}
