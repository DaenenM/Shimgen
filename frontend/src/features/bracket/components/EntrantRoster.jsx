import { Users } from '@/components/icons'
import { teamTone } from '@/features/teams/utils/tone'

// Card grid showing who's on each team, at the foot of the bracket. Used by
// TournamentDetailPage.jsx and SpectatorPage.jsx — entrant labels are per-event
// nicknames (plan §3), so this is how people remember who's actually on "Blue Shells".
// `eliminated`: ids derived from cached matches, so cards grey out on click (falls back to the server flag).
export function EntrantRoster({ entrants, eliminated }) {
  if (!entrants?.length) return null

  // Solo entrants carry no useful roster: the label already is the player.
  const anyMembers = entrants.some((e) => (e.players?.length ?? 0) > 0)
  if (!anyMembers) return null

  const anyTeams = entrants.some((e) => (e.players?.length ?? 0) > 1)

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold sm:text-lg">
        <Users className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
        {anyTeams ? 'Teams' : 'Entrants'}
      </h2>
      <p className="text-base-content/60 mb-3 text-sm sm:mb-4">
        {anyTeams ? 'Who is playing for each team.' : 'Everyone taking part in this tournament.'}
      </p>

      <ul className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {entrants.map((entrant, index) => {
          const members = entrant.players ?? []
          // Same scale as the generator, keyed off the same position, so a team
          // keeps the colour it was given when it was drawn.
          const tone = teamTone(index)
          const out = eliminated ? eliminated.has(entrant.id) : entrant.eliminated

          return (
            <li
              key={entrant.id}
              className={`glass-panel overflow-hidden ${out ? 'opacity-50' : ''}`}
              style={{ borderTopColor: tone.edge }}
            >
              {/* Team colour as a gradient wash, matching the team generator. */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-16 sm:h-24"
                style={{ background: `linear-gradient(to bottom, ${tone.wash}, transparent)` }}
                aria-hidden="true"
              />
              <div className="relative flex flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-bold"
                    style={{ backgroundColor: tone.wash, color: tone.edge }}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>

                  <h3
                    className={`min-w-0 flex-1 truncate text-sm font-semibold sm:text-base ${out ? 'line-through' : ''}`}
                  >
                    {entrant.label}
                  </h3>

                  <span className="bg-base-content/8 text-base-content/70 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                    {members.length || 1}
                  </span>
                </div>

                {members.length > 0 ? (
                  <ul className="space-y-1">
                    {members.map((player) => (
                      <li key={player.id} className="flex items-center gap-2 text-xs sm:text-sm">
                        {player.display_name}
                        {/* Linked players' results follow their account across events (plan §3). */}
                        {player.linked && (
                          <span
                            className="bg-primary h-1.5 w-1.5 rounded-full"
                            title="Linked account"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base-content/50 text-sm italic">No players listed</p>
                )}

                {out && <p className="text-base-content/50 text-xs">Eliminated</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
