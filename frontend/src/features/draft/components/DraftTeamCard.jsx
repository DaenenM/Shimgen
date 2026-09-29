/** One captain's team: who they have picked so far, and the slots still open. */
export function DraftTeamCard({ team, expectedSize = 0 }) {
  const empty = Math.max(0, expectedSize - team.members.length)

  return (
    <div
      className={`glass-panel p-4 transition-all duration-200 ${
        team.is_picking ? 'border-primary/50 shadow-primary/20 shadow-lg' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">
          {team.label || `${team.captain_label}'s team`}
        </span>

        {team.is_picking && (
          <span className="bg-primary/15 text-primary shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
            Picking
          </span>
        )}
      </div>

      <ul className="space-y-1">
        {team.members.map((member, position) => (
          <li
            key={member}
            className="flex items-center gap-2 text-sm"
            // The captain is first in `members` and is not a pick — marking them
            // keeps the list honest about who chose whom.
            title={position === 0 ? 'Captain' : undefined}
          >
            {position === 0 ? (
              <span className="text-primary text-xs font-bold">C</span>
            ) : (
              <span className="text-base-content/30 text-xs">{position}</span>
            )}
            <span className="truncate">{member}</span>
          </li>
        ))}

        {/* Empty slots, so a team that is a player short is visible before the
            final pick rather than after it. */}
        {Array.from({ length: empty }).map((_, slot) => (
          <li
            key={`empty-${slot}`}
            className="text-base-content/25 flex items-center gap-2 text-sm italic"
          >
            <span className="text-xs">·</span>
            empty
          </li>
        ))}
      </ul>
    </div>
  )
}
