// One captain's team: picks so far and open slots. Used by DraftLobbyPage.jsx.
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
            title={position === 0 ? 'Captain' : undefined} // captain is members[0], not a pick
          >
            {position === 0 ? (
              <span className="text-primary text-xs font-bold">C</span>
            ) : (
              <span className="text-base-content/30 text-xs">{position}</span>
            )}
            <span className="truncate">{member}</span>
          </li>
        ))}

        {/* Shows a short-handed team before the final pick, not after. */}
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
