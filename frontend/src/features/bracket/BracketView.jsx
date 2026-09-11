import { MatchCard } from './MatchCard'
import { SECTION_LABELS, isPhantom, roundLabel, roundTone, sectionsFor, toRounds } from './layout'

/**
 * An elimination bracket, as columns of matches joined by connector lines.
 *
 * Rounds scroll horizontally rather than shrinking to fit: a 32-entrant bracket
 * squeezed into a phone width is unreadable, and scrolling is the honest answer.
 * Each section (winners, losers, grand final) is its own scroller so the losers
 * bracket does not drag the winners bracket sideways with it.
 *
 * The connectors are drawn with borders rather than SVG. Every pair of cards in
 * a round is wrapped in a flex column that splits the available height evenly,
 * so a card in the next round lands exactly on the midpoint between its two
 * feeders without anything being measured — the browser's own layout does the
 * arithmetic, and it stays right when a card grows a best-of footer.
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

/** Horizontal reach of a connector, and half the gap between two columns. */
const ARM = 'w-8'

function BracketSection({ section, matches, showHeading, canReport, onReport, onClear }) {
  const rounds = toRounds(matches, section)
  if (rounds.length === 0) return null

  const totalRounds = rounds[rounds.length - 1].roundNo

  // Phantom matches are structural placeholders the engine never fills, so
  // they are dropped before anything is drawn — a connector to one would point
  // at empty space.
  const columns = rounds
    .map((round) => ({
      ...round,
      matches: round.matches.filter((match) => !isPhantom(match, matches)),
    }))
    .filter((round) => round.matches.length > 0)

  return (
    <section>
      {showHeading && (
        <h3 className="mb-3">
          <span className="glass-inset text-base-content/70 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            {SECTION_LABELS[section]}
          </span>
        </h3>
      )}

      <div className="overflow-x-auto pb-2">
        {/* Headings sit in their own row above the bracket. Inside the columns
            they would be part of what the connectors align against, and every
            line would sit a heading's height too low. */}
        {columns.length > 1 && (
          <div className="flex min-w-min">
            {columns.map(({ roundNo }, index) => (
              <div key={roundNo} className="flex">
                {index > 0 && <span className={`${ARM} shrink-0`} />}
                <h4 className="w-64 shrink-0 text-center">
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase"
                    style={{
                      color: roundTone(roundNo, totalRounds, section).color,
                      backgroundColor: roundTone(roundNo, totalRounds, section).wash,
                    }}
                  >
                    {roundLabel(roundNo, totalRounds, section, index + 1)}
                  </span>
                </h4>
                {index < columns.length - 1 && <span className={`${ARM} shrink-0`} />}
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex min-w-min items-stretch">
          {columns.map((round, index) => (
            <Round
              key={round.roundNo}
              matches={round.matches}
              isFirst={index === 0}
              isLast={index === columns.length - 1}
              canReport={canReport}
              onReport={onReport}
              onClear={onClear}
              tone={roundTone(round.roundNo, totalRounds, section)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * One column, with the connector arms either side of it.
 *
 * Cards are paired: each pair shares a bracket that reaches right to the
 * midpoint between them, which is where the next round's card sits. An odd card
 * out — a bye that carried straight through — gets a plain horizontal line
 * instead, so it still visibly leads somewhere.
 */
function Round({ matches, isFirst, isLast, canReport, onReport, onClear, tone }) {
  // Group by where each match actually advances to, rather than assuming every
  // round halves. A losers bracket alternates: a "minor" round pairs each
  // survivor with a fresh drop from the winners bracket, so two matches feed
  // two matches one-to-one. Chopping the column into pairs regardless drew a
  // bracket joining two cards that never meet — which is what made the losers
  // bracket read as a mess of stubby, meaningless elbows.
  const groups = []
  for (const match of matches) {
    const target = match.next_match_win ?? null
    const last = groups[groups.length - 1]

    if (last && target !== null && last.target === target) {
      last.matches.push(match)
    } else {
      groups.push({ target, matches: [match] })
    }
  }

  return (
    <div className="flex items-stretch">
      {/* Incoming arms. Each mirrors its card's own slot — same flex-1, same
          padding — so the line lands on the card's vertical centre whatever
          height that card happens to be. */}
      {!isFirst && (
        <div className="flex shrink-0 flex-col">
          {matches.map((match) => (
            <div key={match.id} className="flex flex-1 items-center py-1.5">
              <span className={`${ARM} border-base-content/25 block border-t`} />
            </div>
          ))}
        </div>
      )}

      <div className="flex w-64 shrink-0 flex-col">
        {matches.map((match) => (
          // Each card takes an equal share of the column's height and centres
          // itself in it. That is what puts a later round's card level with the
          // midpoint of the group feeding it, at any depth.
          <div key={match.id} className="flex flex-1 items-center py-1.5">
            <div className="w-full">
              <MatchCard
                match={match}
                canReport={canReport}
                onReport={(side) => onReport(match.id, side)}
                onClear={() => onClear(match.id)}
                tone={tone}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Outgoing arms.

          Built from the same slots the cards use, so the geometry cannot drift:
          the upper half draws its border along the bottom edge of its slot and
          the lower half along the top of its own, meeting exactly halfway
          between the two card centres. */}
      {!isLast && (
        <div className="flex shrink-0 flex-col">
          {groups.map((group, index) => (
            <div
              key={index}
              className="flex flex-col"
              // A group spans one slot per match it holds, so the elbows line
              // up with the cards they belong to.
              style={{ flex: group.matches.length }}
            >
              {group.matches.length === 2 ? (
                <>
                  {/* Upper: out of the card's centre, then down. */}
                  <div className="flex flex-1 flex-col justify-center py-1.5">
                    <span className="flex-1" />
                    <span
                      className={`${ARM} border-base-content/25 block flex-1 rounded-tr border-t border-r`}
                    />
                  </div>
                  {/* Lower: up from the card's centre to meet it. */}
                  <div className="flex flex-1 flex-col justify-center py-1.5">
                    <span
                      className={`${ARM} border-base-content/25 block flex-1 rounded-br border-r border-b`}
                    />
                    <span className="flex-1" />
                  </div>
                </>
              ) : (
                // One match advancing on its own: a straight line across. This
                // is the common case in a losers minor round, and drawing it
                // flat is what makes the progression legible.
                group.matches.map((match) => (
                  <div key={match.id} className="flex flex-1 items-center py-1.5">
                    <span className={`${ARM} border-base-content/25 block border-t`} />
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
