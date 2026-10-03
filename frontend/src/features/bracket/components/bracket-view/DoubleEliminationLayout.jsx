import { useDragScroll } from '@/hooks/useDragScroll'

import {
  SLOT_PAD,
  gridSizeFor,
  roundLabel,
  roundTone,
  sectionColumns,
  toRounds,
} from '../../utils/layout'
import { MatchCard } from '../MatchCard'
import { FinalsConnector } from './FinalsConnector'
import { RoundColumns } from './RoundColumns'
import { RoundHeadings } from './RoundHeadings'
import { RoundPill } from './RoundPill'
import { SectionLabel } from './SectionLabel'

// Double elimination with a grand final: winners and losers share one grid so the grand
// final can sit beside the winners final with both finals' lines joining it. Used by BracketView.jsx.
// Rows: 1 winners label, 2 headings, 3 cards, 4 gap, 5 losers label, 6 headings, 7 cards.
// Cols: 1 brackets, 2 connector, 3 grand final, 4 connector, 5 bracket reset.
export function DoubleEliminationLayout({ matches, canReport, onReport, onClear }) {
  const scroller = useDragScroll()

  const main = sectionColumns(matches, 'main')
  const lower = sectionColumns(matches, 'losers')
  const finals = toRounds(matches, 'final')
  const lastFinal = finals[finals.length - 1]?.roundNo ?? 0
  const [grand, reset] = finals.map((round) => round.matches[0])

  // One size for the whole grid, counting the two finals columns, so it fits the page.
  const size = gridSizeFor(Math.max(main.columns.length, lower.columns.length) + 2)
  const winners = { ...main, size }
  const losers = { ...lower, size }
  const hasLosers = losers.columns.length > 0
  // Seated only once the losers-side finalist wins the grand final.
  const resetLive = Boolean(reset && (reset.a || reset.b || reset.winner))

  const card = (match) => (
    <MatchCard
      match={match}
      canReport={canReport}
      onReport={(side) => onReport(match.id, side)}
      onClear={() => onClear(match.id)}
      tone={roundTone(match.round_no, lastFinal, 'final')}
    />
  )

  return (
    <section ref={scroller} className="overflow-x-auto pb-2">
      <div className="grid min-w-min grid-cols-[repeat(5,max-content)]">
        <div className="col-start-1 row-start-1">
          <SectionLabel section="main" />
        </div>

        <div className="col-start-1 row-start-2 self-end">
          <RoundHeadings {...winners} section="main" />
        </div>
        {[grand, reset].map(
          (match, index) =>
            match && (
              <div
                key={match.id}
                className={`${index ? 'col-start-5' : 'col-start-3'} row-start-2 mb-2 self-end`}
              >
                <RoundPill
                  label={roundLabel(match.round_no, lastFinal, 'final')}
                  tone={roundTone(match.round_no, lastFinal, 'final')}
                  size={size}
                />
              </div>
            ),
        )}

        <div className="col-start-1 row-start-3 flex">
          <RoundColumns
            {...winners}
            section="main"
            canReport={canReport}
            onReport={onReport}
            onClear={onClear}
          />
          <FinalsConnector part="trail" size={size} />
        </div>
        <div className="col-start-2 row-start-3 flex">
          <FinalsConnector part="junction" size={size} withRiser={hasLosers} />
        </div>
        {grand && (
          <div className={`${size.card} col-start-3 row-start-3 flex items-center ${SLOT_PAD}`}>
            <div className="w-full">{card(grand)}</div>
          </div>
        )}

        {reset && (
          <>
            <div className="col-start-4 row-start-3 flex">
              <FinalsConnector part="flat" size={size} dashed={!resetLive} />
            </div>
            <div
              className={`${size.card} col-start-5 row-start-3 flex items-center ${SLOT_PAD} transition-all duration-300 ${
                resetLive ? '' : 'opacity-40 grayscale'
              }`}
              title={
                resetLive
                  ? undefined
                  : 'Only played if the losers-bracket team wins the grand final'
              }
            >
              <div className="w-full">{card(reset)}</div>
            </div>
          </>
        )}

        {hasLosers && (
          <>
            <div className="col-start-1 row-start-4 h-6 sm:h-8" />
            <div className="col-start-1 row-start-5">
              <SectionLabel section="losers" />
            </div>
            <div className="col-start-1 row-start-6 self-end">
              <RoundHeadings {...losers} section="losers" />
            </div>
            <div className="col-start-2 row-start-4 row-end-7 flex">
              <FinalsConnector part="riser" size={size} />
            </div>

            <div className="col-start-1 row-start-7 flex">
              <RoundColumns
                {...losers}
                section="losers"
                canReport={canReport}
                onReport={onReport}
                onClear={onClear}
              />
              <FinalsConnector part="trail" size={size} />
            </div>
            <div className="col-start-2 row-start-7 flex">
              <FinalsConnector part="elbow" size={size} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
