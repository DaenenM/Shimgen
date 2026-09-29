import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'

const BEST_OF = [1, 3, 5, 7].map((n) => ({
  value: n,
  label: n === 1 ? 'Single game' : `Best of ${n}`,
}))

// Series length plus per-format extras (3rd place, bracket reset). Used by SettingsPanel.jsx.
export function MatchOptions({
  format,
  bestOf,
  onBestOfChange,
  thirdPlace,
  onThirdPlaceChange,
  bracketReset,
  onBracketResetChange,
}) {
  return (
    <div className="grid gap-4">
      <div className="flex w-full flex-col gap-1.5">
        <span className="text-sm font-medium">Games per bracket</span>
        <Select
          label="Games per bracket"
          value={bestOf}
          onChange={onBestOfChange}
          options={BEST_OF}
          size="lg"
        />
      </div>

      {/* Names only; the one that needs explanation keeps it as hover text (title attr). */}
      {format === 'single' && (
        <Toggle label="Play for 3rd place" checked={thirdPlace} onChange={onThirdPlaceChange} />
      )}

      {format === 'double' && (
        <Toggle
          label="Second chance for 1st"
          title="The losers-bracket team must win the final twice, since their opponent has not lost yet."
          checked={bracketReset}
          onChange={onBracketResetChange}
        />
      )}
    </div>
  )
}
