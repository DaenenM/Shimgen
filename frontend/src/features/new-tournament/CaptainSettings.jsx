import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Stepper } from '@/components/ui/Stepper'

const CAPTAIN_MODES = [
  ['random', 'Random captains'],
  ['manual', 'Choose captains'],
]

/**
 * Captains mode: how many sides, and who leads them.
 *
 * `captains` is `{ count, mode, chosen }`; `onChange` takes an updater.
 */
export function CaptainSettings({ captains, names, onChange }) {
  const { count, mode, chosen } = captains
  const set = (changes) => onChange((current) => ({ ...current, ...changes }))

  function toggleCaptain(name) {
    onChange((current) => ({
      ...current,
      chosen: current.chosen.includes(name)
        ? current.chosen.filter((n) => n !== name)
        : current.chosen.length < current.count
          ? [...current.chosen, name]
          : current.chosen,
    }))
  }

  return (
    <div>
      <span className="text-sm font-medium">Teams</span>
      <p className="text-base-content/50 mt-0.5 text-xs">
        Captains are taken out of the player list, then draft the rest between them.
      </p>

      <div className="mt-2 flex items-center gap-3">
        <Stepper
          value={count}
          min={2}
          max={Math.max(2, names.length)}
          onChange={(update) =>
            onChange((current) => ({ ...current, count: update(current.count) }))
          }
          lessLabel="One team fewer"
          moreLabel="One team more"
        />

        <p className="text-base-content/50 min-w-0 text-xs">
          {names.length > count
            ? `${count} captains draft ${names.length - count} players.`
            : 'Add players to see the split.'}
        </p>
      </div>

      <SegmentedControl
        label="How captains are chosen"
        options={CAPTAIN_MODES}
        value={mode}
        onChange={(next) => set({ mode: next })}
        size="sm"
        className="mt-3"
      />

      {/* Chosen from the names already typed rather than a separate field: a
          captain who is not in the player list is a captain the draft cannot
          seat. Clicking toggles, and the count caps at the team count so the
          selection cannot overrun. */}
      {mode === 'manual' && (
        <div className="mt-2.5">
          {names.length === 0 ? (
            <p className="text-base-content/50 text-xs">
              Add players first, then pick which of them captain.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {names.map((name) => {
                const picked = chosen.includes(name)

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleCaptain(name)}
                    disabled={!picked && chosen.length >= count}
                    className={`h-8 rounded-full px-3 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30 ${
                      picked
                        ? 'bg-primary text-primary-content'
                        : 'glass-raised hover:border-primary/50 hover:text-primary'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
