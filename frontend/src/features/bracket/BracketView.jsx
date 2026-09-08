import { MatchCard } from './MatchCard'
import { SECTION_LABELS, isPhantom, roundLabel, sectionsFor, toRounds } from './layout'

/**
 * An elimination bracket, as columns of matches.
 *
 * Rounds scroll horizontally rather than shrinking to fit: a 32-entrant bracket
 * squeezed into a phone width is unreadable, and scrolling is the honest answer.
 * Each section (winners, losers, grand final) is its own scroller so the losers
 * bracket does not drag the winners bracket sideways with it.
 */
export function BracketView({ matches, canReport, onReport = () => {}, onClear = () => {} }) {
  const sections = sectionsFor(matches)

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <BracketSection
          key={section}
          section={section}
          matches={matches}
          showHeading={sections.length > 1}
          canReport={canReport}
          onReport={onReport}
          onClear={onClear}
        />
      ))}
    </div>
  )
}

function BracketSection({ section, matches, showHeading, canReport, onReport, onClear }) {
  const rounds = toRounds(matches, section)
  if (rounds.length === 0) return null

  const totalRounds = rounds[rounds.length - 1].roundNo

  return (
    <section>
      {showHeading && (
        <h3 className="text-base-content/70 mb-3 text-sm font-semibold tracking-wide uppercase">
          {SECTION_LABELS[section]}
        </h3>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-min gap-6">
          {rounds.map(({ roundNo, matches: roundMatches }) => {
            const visible = roundMatches.filter((m) => !isPhantom(m, matches))
            if (visible.length === 0) return null

            return (
              // Cards stay centred against the round that feeds them, so a later
              // round sits level with the middle of the pair below it — the
              // usual bracket diagonal.
              <div
                key={roundNo}
                className="flex w-64 shrink-0 flex-col items-stretch justify-center gap-4"
              >
                {visible.map((match, index) => (
                  <div key={match.id}>
                    {/* The heading rides with the column's first card rather
                        than sitting in a row across the top of the bracket.
                        Pinned up there it ended up far above the boxes it
                        named, because later rounds hold fewer cards and centre
                        lower down. A single-round section is already named by
                        its own heading, so it needs no per-column label. */}
                    {index === 0 && rounds.length > 1 && (
                      <h4 className="text-base-content/60 mb-2 text-center text-sm font-semibold">
                        {roundLabel(roundNo, totalRounds, section)}
                      </h4>
                    )}

                    <MatchCard
                      match={match}
                      canReport={canReport}
                      onReport={(a, b) => onReport(match.id, a, b)}
                      onClear={() => onClear(match.id)}
                    />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
