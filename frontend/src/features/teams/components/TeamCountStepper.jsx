import { Stepper } from '@/components/ui/Stepper'

import { splitEvenly } from '../utils/generate'

// "Number of teams" stepper with a short split summary. Used by TeamSetupPanel.jsx.
// Shows a range ("2-3 each") since splitEvenly never makes teams more than one apart.
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
