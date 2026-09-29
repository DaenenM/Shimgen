import { CopyLinkButton } from '@/components/ui/CopyLinkButton'

// Draft lobby title, turn indicator, and share link. Used by DraftLobbyPage.jsx.
export function DraftHeader({ tournament, draft, current, ready, lobbyUrl, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {tournament?.title || 'Team draft'}
        </h1>

        {/* Most important element on the page — a passed-around device needs an at-a-glance turn check. */}
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

      {/* Link so others can join directly rather than needing to be told where to look. */}
      <CopyLinkButton
        url={lobbyUrl}
        label="Share lobby"
        title="Copy a link to this lobby for the people in the draft"
        className="shrink-0"
      />
    </div>
  )
}
