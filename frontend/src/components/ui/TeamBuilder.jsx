import { Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { useRoster } from '@/hooks/useRoster'

/**
 * Build teams by hand, rather than randomising them.
 *
 * The team generator answers "split these ten people fairly". This answers the
 * other half: the teams already exist — the same pairs turn up every Saturday —
 * and the host just needs to write them down.
 *
 * Each team is `{ label, members }`, which is exactly the `entrant_teams` shape
 * the API takes, so nothing has to be translated on submit.
 *
 * The saved roster is no longer rendered inside each card — it lives beside the
 * form as its own column, and `activeTeam` says which card its clicks land in.
 * A copy of the roster per team card meant the same forty names drawn four
 * times, and a form that grew every time one wrapped.
 */
export function TeamBuilder({ teams, onChange, activeTeam = 0, onFocusTeam = () => {} }) {
  const { remember } = useRoster()

  const update = (index, patch) =>
    onChange(teams.map((team, i) => (i === index ? { ...team, ...patch } : team)))

  const addTeam = () => onChange([...teams, { label: '', members: [] }])
  const removeTeam = (index) => onChange(teams.filter((_, i) => i !== index))

  // Everyone already placed on any team. Nobody can play for two sides at
  // once, so a name taken elsewhere is neither suggested again nor accepted if
  // typed — computed across the whole tournament rather than per card, which
  // only stopped duplicates within a single team.
  const assigned = new Set(teams.flatMap((team) => team.members.map((name) => name.toLowerCase())))

  return (
    // A column that fills whatever height it is given, so the list between the
    // header and the add button is the only part that scrolls — both stay put
    // and reachable no matter how many teams there are.
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-baseline justify-between">
        <span className="text-sm font-medium">
          Teams <span className="text-base-content/50">({teams.length})</span>
        </span>
        {teams.length > 0 && (
          <button
            type="button"
            className="text-base-content/50 hover:text-base-content text-xs transition-colors"
            onClick={() => onChange([])}
          >
            Clear all
          </button>
        )}
      </div>

      <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {teams.map((team, index) => (
          <TeamCard
            key={index}
            team={team}
            index={index}
            assigned={assigned}
            active={index === activeTeam}
            onFocus={() => onFocusTeam(index)}
            onUpdate={(patch) => update(index, patch)}
            onRemove={() => removeTeam(index)}
            onRemember={remember}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={addTeam}
        className="border-base-300 text-base-content/60 hover:border-primary/60 hover:text-primary flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-medium transition-colors duration-150"
      >
        <Plus className="h-4 w-4" />
        Add a team
      </button>

      {teams.length === 1 && (
        <p className="text-base-content/50 text-center text-xs">
          A tournament needs at least two teams.
        </p>
      )}
    </div>
  )
}

function TeamCard({ team, index, assigned, active, onFocus, onUpdate, onRemove, onRemember }) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Add one or several names at once.
   *
   * Anyone already placed on any team is skipped and named in the message,
   * rather than the whole paste being rejected — a list of five where one is
   * a duplicate should add the other four.
   */
  const addMembers = (raw) => {
    const names = raw
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean)

    if (names.length === 0) return

    const added = []
    const skipped = []
    const seen = new Set(assigned)

    for (const name of names) {
      const key = name.toLowerCase()
      if (seen.has(key)) {
        skipped.push(name)
        continue
      }
      seen.add(key)
      added.push(name)
    }

    if (added.length > 0) {
      onUpdate({ members: [...team.members, ...added] })
      onRemember(added)
    }

    setDraft(skipped.length > 0 && added.length === 0 ? raw : '')
    setError(
      skipped.length > 0
        ? `${skipped.join(', ')} ${skipped.length === 1 ? 'is' : 'are'} already on a team.`
        : null,
    )
  }

  const removeMember = (name) => onUpdate({ members: team.members.filter((m) => m !== name) })

  return (
    // Clicking anywhere on a card makes it the one the roster fills, so
    // picking names for team three is: click the card, then click the names.
    <li
      onClick={onFocus}
      className={`rounded-xl border p-2.5 transition-colors duration-150 ${
        active ? 'border-primary/60 bg-primary/5' : 'border-base-300 bg-base-200/40'
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="bg-primary/15 text-primary grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold">
          {index + 1}
        </span>

        <input
          className="input input-bordered input-sm flex-1 rounded-lg font-medium"
          placeholder={`Team ${index + 1}`}
          value={team.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          aria-label={`Name for team ${index + 1}`}
        />

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove team ${index + 1}`}
          className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-150"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {team.members.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {team.members.map((name) => (
            <span
              key={name}
              className="bg-primary text-primary-content inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium"
            >
              {name}
              <button
                type="button"
                onClick={() => removeMember(name)}
                aria-label={`Remove ${name} from team ${index + 1}`}
                className="hover:bg-primary-content/20 grid h-4 w-4 place-items-center rounded-full transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* One paste box rather than a field and a button: a team is usually
          entered as a couple of names at once, and this takes one as happily
          as several.

          A single row at rest, growing to three once focused. Eight teams each
          holding a permanent two-row box and a full-width button was most of
          the page height, spent on controls nobody was using at that moment. */}
      <div className="flex items-start gap-1.5">
        <textarea
          className="textarea textarea-bordered min-h-0 flex-1 resize-none rounded-lg py-1.5 text-sm transition-all duration-150"
          rows={draft || focused ? 3 : 1}
          placeholder={'Names…'}
          value={draft}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          aria-label={`Add players to team ${index + 1}`}
        />

        <button
          type="button"
          onClick={() => addMembers(draft)}
          disabled={!draft.trim()}
          className="bg-primary/15 text-primary hover:bg-primary/25 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Add players to team ${index + 1}`}
          title="Add them"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="text-error mt-1.5 text-xs">{error}</p>}
    </li>
  )
}
