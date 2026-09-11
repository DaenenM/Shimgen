import { Link2, Minus, Pencil, Plus, Shuffle, Swords, Trash2 } from '@/components/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { RosterPicker } from '@/components/ui/RosterPicker'
import { SavedRoster } from '@/components/ui/SavedRoster'
import { generateTeams, splitEvenly } from '@/features/teams/generate'
import { useRoster } from '@/hooks/useRoster'
import { paths } from '@/routes/paths'

/**
 * A colour per generated team.
 *
 * Six hues at one fixed lightness and chroma, so no team looks more important
 * than another — which is the whole point of a random split. Varying only hue
 * is what keeps that true; drop the lightness on one and it reads as the B
 * team.
 *
 * Carried on a left edge and the team's number rather than as a card wash: four
 * tinted cards side by side is a swatch book, and the names inside them are
 * what people are actually trying to read.
 */
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

/**
 * The team generator (plan §3).
 *
 * Works with no account at all — that is half the reason people arrive. The
 * constraints are the differentiator over a plain randomiser: "these two can't
 * be on the same team" is the thing every group actually needs.
 */
export function TeamGeneratorPage() {
  const { touchLocal } = useRoster()

  const [names, setNames] = useState([])
  const [teamCount, setTeamCount] = useState(2)
  const [constraints, setConstraints] = useState([])
  const [draft, setDraft] = useState({ kind: 'apart', a: '', b: '' })
  const [result, setResult] = useState(null)

  // Team names, keyed by index. Kept apart from `result` so a re-roll shuffles
  // the players without discarding names the host has already chosen — "The
  // Randoms" should stay "The Randoms" when you re-roll who is in it.
  const [teamNames, setTeamNames] = useState({})

  const nameFor = (index) => teamNames[index]?.trim() || `Team ${index + 1}`

  // A rule is only real while both of its players are still in the list.
  // Removing someone used to leave their rules on screen, still listed but no
  // longer enforceable — so the generator could put a "keep apart" pair
  // together while the rule saying otherwise sat right there in the form.
  const liveConstraints = constraints.filter((c) => names.includes(c.a) && names.includes(c.b))

  // Generating is pure arithmetic on names already on screen, so it runs here
  // rather than as a round trip. Re-rolling is the whole interaction — you
  // press it until the split looks right — and a request per press made that
  // feel like work. Nothing is saved until a tournament is created from it.
  const [error, setError] = useState(null)

  function runGenerate() {
    setError(null)

    // Ids are positions in the name list, which is all the rules need: they
    // travel as names and are resolved against this same list, so a rule can
    // never point at somebody who is no longer in it.
    const players = names.map((name, index) => ({ id: index, name }))
    const idsFor = (name) =>
      names.map((n, index) => (n === name ? index : -1)).filter((index) => index !== -1)

    // A name can appear twice, so a rule about "Alex" covers every Alex.
    const constraintsForRun = liveConstraints.flatMap((c) => {
      const left = idsFor(c.a)
      const right = idsFor(c.b)
      if (!left.length || !right.length) return []
      return [{ kind: c.kind, player_ids: [...new Set([...left, ...right])] }]
    })

    try {
      const teams = generateTeams(players, teamCount, {
        constraints: constraintsForRun,
        // Re-rolling should not hand back the split we just rejected.
        avoid: result?.teams?.map((team) => team.map((p) => p.id)) ?? null,
      })

      setResult({
        teams: teams.map((team) => team.map((p) => ({ id: p.id, name: p.name }))),
        // Two teams is a series, not a bracket — a bracket for two is just
        // ceremony (plan §3).
        suggest_series: teams.length === 2,
      })
      touchLocal(names)
    } catch (err) {
      setError(err.message)
    }
  }

  function addConstraint() {
    if (!draft.a || !draft.b || draft.a === draft.b) return

    // A pair reads the same in either order, so store it one way. That keeps
    // "A and B" from being added twice as "B and A", which would also make two
    // rows indistinguishable in the list.
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

      {/* Roster on the left, form in the middle, results on the right. The
          roster was inside the form until now, which resized the container
          every time the list wrapped onto a new line. */}
      <div className="grid items-start gap-6 lg:grid-cols-[15rem_1fr_1.1fr]">
        <SavedRoster selected={names} onAdd={(name) => setNames((current) => [...current, name])} />

        {/* ── Setup ─────────────────────────────────────────────────────── */}
        <div className="card bg-base-100 border-base-300 min-w-0 border">
          <div className="card-body gap-5">
            <RosterPicker selected={names} onChange={setNames} />

            {/* A stepper rather than a number field. The count is almost always
                two to four and adjusted a step at a time, which a spinner's
                hairline arrows make needlessly fiddly. It also shows the split
                that number produces: 4 teams from nine players is two of three
                and two of two, which is worth seeing before generating. */}
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

            {/* Constraints */}
            <div className="border-base-300 bg-base-200/30 rounded-xl border p-3">
              <span className="text-sm font-medium">Rules</span>
              <p className="text-base-content/50 mb-3 text-xs">
                Couples, carpools, and the two who cannot be trusted together.
              </p>

              {/* Segmented buttons rather than a select: there are exactly two
                  kinds, and a dropdown to choose between two options hides half
                  the answer behind a click. */}
              <div className="border-base-300 bg-base-100 mb-2 inline-flex rounded-lg border p-0.5">
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
                <select
                  className="select select-bordered select-sm min-w-0 flex-1 rounded-lg"
                  value={draft.a}
                  onChange={(e) => setDraft({ ...draft, a: e.target.value })}
                  aria-label="First player in the rule"
                >
                  <option value="">Player…</option>
                  {names.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <span className="text-base-content/40 shrink-0 text-xs">and</span>

                <select
                  className="select select-bordered select-sm min-w-0 flex-1 rounded-lg"
                  value={draft.b}
                  onChange={(e) => setDraft({ ...draft, b: e.target.value })}
                  aria-label="Second player in the rule"
                >
                  <option value="">Player…</option>
                  {names.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={addConstraint}
                  disabled={!draft.a || !draft.b || draft.a === draft.b}
                  className="bg-primary/15 text-primary hover:bg-primary/25 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Add rule"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {liveConstraints.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {liveConstraints.map((c) => (
                    <li
                      key={`${c.kind}-${c.a}-${c.b}`}
                      className="border-base-300 bg-base-100 group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {/* Colour-coded so the two kinds are told apart at a
                            glance rather than by reading each row. */}
                        <span
                          className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${
                            /* Red against green: the pair is an opposition, and
                               pairing red with the brand blue made only half of
                               it mean anything. */
                            c.kind === 'apart'
                              ? 'bg-error/15 text-error'
                              : 'bg-success/15 text-success'
                          }`}
                        >
                          {CONSTRAINT_LABELS[c.kind]}
                        </span>
                        {c.a} &amp; {c.b}
                      </span>
                      <button
                        type="button"
                        aria-label="Remove rule"
                        onClick={() =>
                          setConstraints(
                            constraints.filter(
                              (x) => !(x.kind === c.kind && x.a === c.a && x.b === c.b),
                            ),
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

            {/* No pending state: this runs in the browser and returns within a
                frame, so a spinner would only ever flash. */}
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
              <div className="grid gap-4 sm:grid-cols-2">
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
                            className="input input-ghost input-sm w-full min-w-0 px-1 text-sm font-semibold focus:outline-none"
                            value={teamNames[index] ?? ''}
                            placeholder={`Team ${index + 1}`}
                            onChange={(e) =>
                              setTeamNames({ ...teamNames, [index]: e.target.value })
                            }
                            aria-label={`Name for team ${index + 1}`}
                          />
                          <Pencil className="text-base-content/25 h-3 w-3 shrink-0 group-focus-within:opacity-0" />
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

              {/* A bracket for two teams is just ceremony (plan §3). */}
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
