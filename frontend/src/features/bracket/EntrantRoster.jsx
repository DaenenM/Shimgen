import { Users } from '@/components/icons'

import { teamTone } from '@/features/teams/tone'

/**
 * Who is on which team, as a card grid at the foot of the bracket.
 *
 * An entrant's label is a per-event nickname by design (plan §3), so "Blue
 * Shells" says nothing about who is in it. Halfway through a night people
 * genuinely forget, and scrolling back to the team generator is not an answer
 * once the bracket exists.
 *
 * Laid out like the generator's output on purpose — the same crew in the same
 * shape, so the bracket page confirms what the randomiser produced rather than
 * presenting it differently.
 */
export function EntrantRoster({ entrants }) {
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

          return (
            <li
              key={entrant.id}
              className={`glass-panel overflow-hidden ${entrant.eliminated ? 'opacity-50' : ''}`}
              style={{ borderTopColor: tone.edge }}
            >
              {/* The team's hue as light falling through the top of the panel,
                  exactly as the generator draws it. */}
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
                    className={`min-w-0 flex-1 truncate text-sm font-semibold sm:text-base ${entrant.eliminated ? 'line-through' : ''}`}
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
                        {/* A linked player's results follow their own account
                            across every host's events (plan §3). */}
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

                {entrant.eliminated && <p className="text-base-content/50 text-xs">Eliminated</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
