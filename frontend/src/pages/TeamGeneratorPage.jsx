import {
  Check,
  ChevronDown,
  Link2,
  Minus,
  Pencil,
  Plus,
  Shuffle,
  Swords,
  Trash2,
} from '@/components/icons'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { RosterPicker } from '@/components/ui/RosterPicker'
import { SavedRoster } from '@/components/ui/SavedRoster'
import { generateTeams, splitEvenly } from '@/features/teams/generate'
import { useRoster } from '@/hooks/useRoster'
import { paths } from '@/routes/paths'

const TEAM_HUES = [250, 150, 80, 25, 300, 195]

const teamTone = (index) => {
  const hue = TEAM_HUES[index % TEAM_HUES.length]
  return {
    edge: `oklch(70% 0.13 ${hue})`,
    wash: `oklch(70% 0.13 ${hue} / 0.14)`,
  }
}

const CONSTRAINT_LABELS = {
  apart: 'Keep apart',
  together: 'Keep together',
}

// Shared everywhere a name list needs to come from raw text: the textarea
// itself, and the two staging helpers below that edit it from outside.
function parseNames(text) {
  return text
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter(Boolean)
}

function PlayerSelect({ value, onChange, names, label, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickAway(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="border-base-300 bg-base-100 hover:border-base-content/30 flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border px-2.5 text-sm transition-colors disabled:cursor-not-allowed"
      >
        <span className={`truncate ${value ? '' : 'text-base-content/40'}`}>
          {value || 'Player'}
        </span>
        <ChevronDown className="text-base-content/40 h-3.5 w-3.5 shrink-0" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="border-base-300 bg-base-100 absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border py-1 shadow-lg"
        >
          {names.map((n) => (
            <li key={n} role="option" aria-selected={n === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(n)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  n === value ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-base-200/60'
                }`}
              >
                <span className="truncate">{n}</span>
                {n === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The team generator (plan §3).
 *
 * The player list used to live in its own piece of state, filled by pasting
 * into a box or picking from the saved roster, each writing to the same
 * array. Now there is one source of truth — the textarea's raw text — and
 * `names` is just that text parsed. Picking a saved name stages it into the
 * text instead of a separate list, so there's exactly one place a host looks
 * to see who's in.
 */
export function TeamGeneratorPage() {
  const { touchLocal } = useRoster()

  const [rosterText, setRosterText] = useState('')
  const names = useMemo(() => parseNames(rosterText), [rosterText])

  const [teamCount, setTeamCount] = useState(2)
  const [constraints, setConstraints] = useState([])
  const [draft, setDraft] = useState({ kind: 'apart', a: '', b: '' })
  const [result, setResult] = useState(null)
  const [teamNames, setTeamNames] = useState({})
  const [error, setError] = useState(null)

  const nameFor = (index) => teamNames[index]?.trim() || `Team ${index + 1}`

  const liveConstraints = constraints.filter((c) => names.includes(c.a) && names.includes(c.b))

  // Adds a saved name to the text field rather than to a list — appended as
  // its own line, so it reads the same as if the host had typed it.
  function stageAdd(name) {
    setRosterText((current) => {
      const lines = parseNames(current)
      return [...lines, name].join('\n')
    })
  }

  // Removes a name from the text field by dropping any line that matches it
  // — case-insensitively, since that's how "already added" is judged too.
  function stageRemove(name) {
    setRosterText((current) =>
      parseNames(current)
        .filter((n) => n.toLowerCase() !== name.toLowerCase())
        .join('\n'),
    )
  }

  function runGenerate() {
    setError(null)

    const players = names.map((name, index) => ({ id: index, name }))
    const idsFor = (name) =>
      names.map((n, index) => (n === name ? index : -1)).filter((index) => index !== -1)

    const constraintsForRun = liveConstraints.flatMap((c) => {
      const left = idsFor(c.a)
      const right = idsFor(c.b)
      if (!left.length || !right.length) return []
      return [{ kind: c.kind, player_ids: [...new Set([...left, ...right])] }]
    })

    try {
      const teams = generateTeams(players, teamCount, {
        constraints: constraintsForRun,
        avoid: result?.teams?.map((team) => team.map((p) => p.id)) ?? null,
      })

      setResult({
        teams: teams.map((team) => team.map((p) => ({ id: p.id, name: p.name }))),
        suggest_series: teams.length === 2,
      })
      touchLocal(names)
    } catch (err) {
      setError(err.message)
    }
  }

  function addConstraint() {
    if (!draft.a || !draft.b || draft.a === draft.b) return

    const [a, b] = [draft.a, draft.b].sort()

    const exists = constraints.some((c) => c.kind === draft.kind && c.a === a && c.b === b)
    if (!exists) setConstraints([...constraints, { kind: draft.kind, a, b }])

    setDraft({ kind: draft.kind, a: '', b: '' })
  }

  const canGenerate = names.length >= 2 && names.length >= teamCount

  return (
    <PageShell>
      <PageHeader
        title="Team Generator"
        description="Split a group into balanced teams, with the rules your crew actually needs."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[11rem_1.2fr_1.15fr]">
        <SavedRoster selected={names} onAdd={stageAdd} onRemove={stageRemove} />

        {/* ── Setup ─────────────────────────────────────────────────────── */}
        <div className="card bg-base-100 border-base-300 min-w-0 border">
          <div className="card-body gap-5">
            <RosterPicker value={rosterText} onChange={setRosterText} count={names.length} />

            <div className="border-base-300 bg-base-200/30 flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <span className="text-sm font-medium">Number of teams</span>
                <p className="text-base-content/50 mt-0.5 text-xs">
                  {names.length >= 2
                    ? `Splits ${names.length} players into ${splitEvenly(names.length, teamCount).join(' / ')}`
                    : 'Add players to see the split.'}
                </p>
              </div>

              <div className="border-base-300 bg-base-100 flex shrink-0 items-center rounded-lg border">
                <button
                  type="button"
                  onClick={() => setTeamCount((n) => Math.max(2, n - 1))}
                  disabled={teamCount <= 2}
                  aria-label="One team fewer"
                  className="hover:text-primary grid h-9 w-9 place-items-center rounded-l-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" />
                </button>

                <span className="tabular w-10 text-center text-lg font-bold">{teamCount}</span>

                <button
                  type="button"
                  onClick={() => setTeamCount((n) => Math.min(Math.max(2, names.length), n + 1))}
                  disabled={teamCount >= Math.max(2, names.length)}
                  aria-label="One team more"
                  className="hover:text-primary grid h-9 w-9 place-items-center rounded-r-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Rules */}
            <div className="border-base-300 rounded-xl border p-3">
              <div className="mb-2">
                <span className="text-sm font-medium">Rules</span>
                <p className="text-base-content/50 mt-0.5 text-xs">Who to keep apart or together.</p>
              </div>

              {/* Builder: its own subtle panel, separating "make a rule" from the
                  rules already made below it. */}
              <div className="bg-base-200/40 space-y-2 rounded-lg p-2.5">
                <div className="border-base-300 bg-base-100 inline-flex rounded-lg border p-0.5">
                  {[
                    ['apart', 'Keep apart'],
                    ['together', 'Keep together'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDraft({ ...draft, kind: value })}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                        draft.kind === value
                          ? 'bg-primary text-primary-content'
                          : 'text-base-content/60 hover:text-base-content'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <PlayerSelect
                    label="First player in the rule"
                    value={draft.a}
                    onChange={(a) => setDraft({ ...draft, a })}
                    names={names}
                    disabled={names.length === 0}
                  />

                  <span className="text-base-content/40 shrink-0 text-xs">and</span>

                  <PlayerSelect
                    label="Second player in the rule"
                    value={draft.b}
                    onChange={(b) => setDraft({ ...draft, b })}
                    names={names}
                    disabled={names.length === 0}
                  />

                  <button
                    type="button"
                    onClick={addConstraint}
                    disabled={!draft.a || !draft.b || draft.a === draft.b}
                    className="bg-primary text-primary-content hover:bg-primary/90 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Add rule"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Existing rules: a plain list below the builder, visually distinct
                  from it rather than crammed into the same panel. A dot carries the
                  apart/together colour instead of a full text badge repeated on every
                  row — the builder above already spells out what each kind means. */}
              {liveConstraints.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {liveConstraints.map((c) => (
                    <li
                      key={`${c.kind}-${c.a}-${c.b}`}
                      className="group hover:bg-base-200/40 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            c.kind === 'apart' ? 'bg-error' : 'bg-success'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{c.a}</span>
                          <span className="text-base-content/40"> {c.kind === 'apart' ? '≠' : '+'} </span>
                          <span className="font-medium">{c.b}</span>
                        </span>
                      </span>

                      <button
                        type="button"
                        aria-label="Remove rule"
                        onClick={() =>
                          setConstraints(
                            constraints.filter((x) => !(x.kind === c.kind && x.a === c.a && x.b === c.b)),
                          )
                        }
                        className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-7 w-7 shrink-0 place-items-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <div role="alert" className="alert alert-error py-2 text-sm">
                {error}
              </div>
            )}

            <button className="btn btn-primary gap-2" disabled={!canGenerate} onClick={runGenerate}>
              <Shuffle className="h-4 w-4" />
              {result ? 'Re-roll teams' : 'Generate teams'}
            </button>

            {!canGenerate && names.length > 0 && (
              <p className="text-base-content/50 text-center text-xs">
                Add at least {Math.max(2, teamCount)} players.
              </p>
            )}
          </div>
        </div>

        {/* ── Result ────────────────────────────────────────────────────── */}
        <div>
          {result ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {result.teams.map((team, index) => (
                  <div
                    key={index}
                    className="card bg-base-100 border-base-300 overflow-hidden border"
                    style={{ borderLeft: `3px solid ${teamTone(index).edge}` }}
                  >
                    <div className="card-body gap-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-bold"
                          style={{
                            backgroundColor: teamTone(index).wash,
                            color: teamTone(index).edge,
                          }}
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        <label className="group flex min-w-0 flex-1 items-center gap-1.5">
                          <input
                            className="input input-ghost input-sm border w-full min-w-0 rounded-md border-base-300/0 px-1 text-sm font-semibold transition-colors duration-150 hover:border-base-300/60 focus:border-primary/40 focus:outline-none"
                            value={teamNames[index] ?? ''}
                            placeholder={`Team ${index + 1}`}
                            onChange={(e) =>
                              setTeamNames({ ...teamNames, [index]: e.target.value })
                            }
                            aria-label={`Name for team ${index + 1}`}
                          />
                        </label>
                        <span className="badge badge-ghost badge-sm shrink-0">{team.length}</span>
                      </div>
                      <ul className="space-y-1">
                        {team.map((player) => (
                          <li key={player.id} className="text-sm">
                            {player.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>

              {result.suggest_series && (
                <div className="alert bg-base-100 border-base-300 border">
                  <Swords className="text-primary h-5 w-5" />
                  <div className="text-sm">
                    <p className="font-medium">Two teams. Play a series instead.</p>
                    <p className="text-base-content/60">
                      A bracket for two is just ceremony. Try a best-of-3 or 5.
                    </p>
                  </div>
                  <Button
                    to={paths.quickStart}
                    state={{
                      names: result.teams.map((_, i) => nameFor(i)),
                      squads: result.teams.map((team, i) => ({
                        label: nameFor(i),
                        members: team.map((p) => p.name),
                      })),
                    }}
                    size="sm"
                  >
                    Set up
                  </Button>
                </div>
              )}

              {!result.suggest_series && (
                <Button
                  to={paths.quickStart}
                  state={{
                    names: result.teams.map((_, i) => nameFor(i)),
                    squads: result.teams.map((team, i) => ({
                      label: nameFor(i),
                      members: team.map((p) => p.name),
                    })),
                  }}
                  icon={Link2}
                  block
                >
                  Put these teams in a bracket
                </Button>
              )}
            </div>
          ) : (
            <div className="border-base-300 text-base-content/40 flex h-full min-h-[16rem] items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm">
              Your teams will appear here.
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}