import { Plus, Trash2 } from '@/components/icons'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PlayerSelect } from '@/features/roster/components/PlayerSelect'

const KINDS = [
  ['apart', 'Keep apart'],
  ['together', 'Keep together'],
]

// Rule builder (keep apart/together) plus the list of existing rules.
// Used by TeamSetupPanel.jsx.
export function RulesPanel({ names, draft, onDraftChange, rules, onAdd, onRemove }) {
  const noNames = names.length === 0

  return (
    <div className="glass-inset p-3">
      <span className="mb-2 block text-sm font-medium">Rules</span>

      {/* Builder panel, separate from the rules list below it. */}
      <div className="border-base-content/5 bg-base-content/4 space-y-2.5 rounded-xl border p-2.5">
        <SegmentedControl
          label="Kind of rule"
          options={KINDS}
          value={draft.kind}
          onChange={(kind) => onDraftChange({ ...draft, kind })}
          size="sm"
        />

        {/* Stacked below `sm`, one row above — two selects + button don't fit on phone. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <PlayerSelect
            label="First player in the rule"
            value={draft.a}
            onChange={(a) => onDraftChange({ ...draft, a })}
            names={names}
            disabled={noNames}
          />

          <span className="text-base-content/40 shrink-0 text-center text-xs sm:text-left">
            and
          </span>

          <PlayerSelect
            label="Second player in the rule"
            value={draft.b}
            onChange={(b) => onDraftChange({ ...draft, b })}
            names={names}
            disabled={noNames}
          />

          <button
            type="button"
            onClick={onAdd}
            disabled={!draft.a || !draft.b || draft.a === draft.b}
            className="bg-primary text-primary-content hover:bg-primary/90 grid h-9 w-full shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30 sm:w-9"
            aria-label="Add rule"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Existing rules. A colour dot marks apart/together instead of a repeated text badge. */}
      {rules.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {rules.map((rule) => (
            <li
              key={`${rule.kind}-${rule.a}-${rule.b}`}
              className="group hover:bg-base-200/40 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    rule.kind === 'apart' ? 'bg-error' : 'bg-success'
                  }`}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate">
                  <span className="font-medium">{rule.a}</span>
                  <span className="text-base-content/40">
                    {' '}
                    {rule.kind === 'apart' ? '≠' : '+'}{' '}
                  </span>
                  <span className="font-medium">{rule.b}</span>
                </span>
              </span>

              <button
                type="button"
                aria-label="Remove rule"
                onClick={() => onRemove(rule)}
                className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-7 w-7 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
