import { Stepper } from '@/components/ui/Stepper'

import { splitEvenly } from './generate'

/**
 * "Number of teams", with one short line saying how the players divide.
 *
 * Listing every team — "Splits 11 players into 3 / 3 / 3 / 2" — grew with the
 * team count and wrapped beside the stepper. `splitEvenly` never makes teams
 * more than one apart, so the whole split fits in a range: "2–3 each", or
 * "3 each" when it comes out even. Short at any team count, so it stays on
 * one line.
 */
export function TeamCountStepper({ count, playerCount, onChange }) {
  return (
    <div className="glass-inset flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <span className="text-sm font-medium">Number of teams</span>
        <p className="text-base-content/50 mt-0.5 truncate text-xs">
          {describeSplit(playerCount, count)}
        </p>
      </div>

      <Stepper
        value={count}
        min={2}
        max={Math.max(2, playerCount)}
        onChange={onChange}
        lessLabel="One team fewer"
        moreLabel="One team more"
      />
    </div>
  )
}

function describeSplit(players, teams) {
  if (players < 2) return 'Add players to see the split.'

  const sizes = splitEvenly(players, teams)
  const smallest = Math.min(...sizes)
  const largest = Math.max(...sizes)
  const each = smallest === largest ? `${largest}` : `${smallest}–${largest}`

  return `${players} players · ${each} each`
}
