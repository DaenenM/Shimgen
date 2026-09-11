import { Check, ChevronDown, Link2, Minus, Pencil, Plus, Shuffle, Trash2 } from '@/components/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { RosterPicker } from '@/components/ui/RosterPicker'
import { SavedRoster } from '@/components/ui/SavedRoster'
import { generateTeams, splitEvenly } from '@/features/teams/generate'
import { teamTone } from '@/features/teams/tone'
import { useElementHeight } from '@/hooks/useElementHeight'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useRoster } from '@/hooks/useRoster'
import { paths } from '@/routes/paths'

/**
 * The page's solid action button.
 *
 * Everything else on this page is glass, so the actions that move you forward
 * are the one opaque thing on it — make them translucent too and the hierarchy
 * flattens out. Shared by both so "Generate teams" and "Put these teams in a
 * bracket" cannot drift apart, which is exactly how the app ended up with three
 * sizes of the same button before `Button` existed.
 *
 * Hover matches the landing page: a small lift, the glow spreading a little,
 * and `ActionSheen` crossing once. The shadow is deliberately restrained —
 * `shadow-md` rising to `shadow-lg`, not `lg` to `xl` — because these sit
 * inside a glass panel rather than on open page, and a heavy drop shadow in
 * there reads as the button floating off the surface it belongs to.
 */
const ACTION_BUTTON =
  'group bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none'

/**
 * The light that crosses a solid action button on hover.
 *
 * Its own component because the effect needs a child element to translate, so
 * a class string alone cannot carry it. Pure transform, so it composites
 * without repainting the label underneath.
 */
function ActionSheen() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
    />
  )
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
        className="glass-inset hover:border-base-content/25 flex h-9 w-full min-w-0 items-center justify-between gap-1.5 px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`truncate ${value ? '' : 'text-base-content/40'}`}>
          {value || 'Player'}
        </span>
        <ChevronDown className="text-base-content/40 h-3.5 w-3.5 shrink-0" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="glass-raised absolute z-20 mt-1.5 max-h-48 w-full overflow-auto py-1"
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

  // The saved roster is capped at the setup column's height and scrolls past
  // it, but still shrinks to fit a short list. Only from `lg` up: below that
  // the columns stack, and capping one to another's height is meaningless.
  const setupRef = useRef(null)
  const setupHeight = useElementHeight(setupRef)
  const isWide = useMediaQuery('(min-width: 64rem)')

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

  // `wide` rather than the default: three columns, the last holding two team
  // cards side by side, does not fit in `normal` without squeezing the names in
  // each card down to a truncated column.
  return (
    <PageShell width="wide" className="glass-backdrop">
      {/* Header and grid share one container sized to exactly what the columns
          occupy — 11 + 22 + 28.75rem of track plus two 1.5rem gaps — so the
          title starts on the same line as the roster rail below it and the
          block is genuinely centred. Centring the grid alone left the heading
          out at the shell's much wider edge; overshooting the total leaves
          dead space on the right, which reads as off-centre. */}
      <div className="mx-auto w-full max-w-[64.75rem]">
        {/* Wrapped rather than given a class: `PageHeader` is shared by every
            page and takes no `className`, and adding a presentational prop for
            one caller would spread this page's choice across all of them. */}
        <div className="rise-in rise-delay-1">
          <PageHeader
            title="Team Generator"
            description="Split a group into balanced teams, with the rules your crew actually needs."
          />
        </div>

        {/* Every column is sized to its contents rather than to a share of the
            row — the roster rail, a fixed-width form, and two team cards
            abreast all have a natural width. */}
        <div className="grid items-start gap-6 lg:grid-cols-[11rem_22rem_28.75rem]">
          {/* `self-start` moves onto the wrapper with the animation.
              `SavedRoster` sets it on its own <aside>, which stops the rail
              stretching to the row's height — but wrapping makes this div the
              grid item, so the alignment has to travel with it or the rail
              grows to match the setup column and the height cap it is given
              stops meaning anything. */}
          <div className="rise-in rise-delay-2 self-start">
            <SavedRoster
              selected={names}
              onAdd={stageAdd}
              onRemove={stageRemove}
              glass
              maxHeight={isWide ? setupHeight : null}
            />
          </div>

          {/* ── Setup ─────────────────────────────────────────────────────── */}
          <div ref={setupRef} className="glass-panel rise-in rise-delay-3 min-w-0">
            <div className="flex flex-col gap-5 p-5">
              <RosterPicker
                value={rosterText}
                onChange={setRosterText}
                count={names.length}
                glass
              />

              <div className="glass-inset flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <span className="text-sm font-medium">Number of teams</span>
                  <p className="text-base-content/50 mt-0.5 text-xs">
                    {names.length >= 2
                      ? `Splits ${names.length} players into ${splitEvenly(names.length, teamCount).join(' / ')}`
                      : 'Add players to see the split.'}
                  </p>
                </div>

                <div className="glass-raised flex shrink-0 items-center overflow-hidden">
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
              <div className="glass-inset p-3">
                <div className="mb-2">
                  <span className="text-sm font-medium">Rules</span>
                  <p className="text-base-content/50 mt-0.5 text-xs">
                    Who to keep apart or together.
                  </p>
                </div>

                {/* Builder: its own subtle panel, separating "make a rule" from the
                  rules already made below it. */}
                <div className="border-base-content/5 bg-base-content/4 space-y-2.5 rounded-xl border p-2.5">
                  {/* The active option is a solid primary fill — the same blue
                      as every other "this is selected" state in the app. What
                      keeps it from reading as a sticker stuck on the glass is
                      the coloured glow beneath it and the lit top edge, so the
                      pill looks lit rather than pasted. The inner radius is a
                      step below the container's so the corners nest. */}
                  <div className="glass-raised inline-flex gap-0.5 rounded-xl p-1">
                    {[
                      ['apart', 'Keep apart'],
                      ['together', 'Keep together'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDraft({ ...draft, kind: value })}
                        aria-pressed={draft.kind === value}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                          draft.kind === value
                            ? 'bg-primary text-primary-content shadow-[inset_0_1px_0_0_oklch(100%_0_0/0.28),0_2px_10px_-2px_var(--color-primary)]'
                            : 'text-base-content/60 hover:bg-base-content/8 hover:text-base-content'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Two selects, a joining word and a button do not fit on one
                    row at phone widths — the names truncated to "Pla…", which
                    is the one thing the control has to show. Stacked below
                    `sm`, one row from there up. */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <PlayerSelect
                      label="First player in the rule"
                      value={draft.a}
                      onChange={(a) => setDraft({ ...draft, a })}
                      names={names}
                      disabled={names.length === 0}
                    />

                    <span className="text-base-content/40 shrink-0 text-center text-xs sm:text-left">
                      and
                    </span>

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
                      className="bg-primary text-primary-content hover:bg-primary/90 grid h-9 w-full shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30 sm:w-9"
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
                            <span className="text-base-content/40">
                              {' '}
                              {c.kind === 'apart' ? '≠' : '+'}{' '}
                            </span>
                            <span className="font-medium">{c.b}</span>
                          </span>
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
                <div
                  role="alert"
                  className="border-error/30 bg-error/12 text-error rounded-xl border px-3 py-2 text-sm"
                >
                  {error}
                </div>
              )}

              <button className={ACTION_BUTTON} disabled={!canGenerate} onClick={runGenerate}>
                <ActionSheen />
                {/* The shuffle mark turning is the one icon animation that says
                    what the button does, so it is worth the rotation. */}
                <Shuffle className="h-4 w-4 transition-transform duration-300 ease-out group-hover:rotate-180" />
                {result ? 'Re-roll teams' : 'Generate teams'}
              </button>
            </div>
          </div>

          {/* ── Result ──────────────────────────────────────────────────────

              The animation sits on this column, never on the team cards inside
              it. The cards are rebuilt on every re-roll, so animating them
              would turn a page-load greeting into something that fires each
              time somebody presses Generate — and a result you are comparing
              against the last one should not slide about while you read it. */}
          <div className="rise-in rise-delay-4">
            {result ? (
              <div className="max-w-[28.75rem] space-y-4">
                {/* The cap above is two team cards plus their gap, so the button
                  and the series hint line up with the cards rather than running
                  out to the full column width beside them. */}
                {/* Two across, but each column capped rather than splitting the
                  full width: a team card is a short list of names, and at the
                  column's natural width it was mostly empty space with a name
                  stranded on the left. `justify-start` keeps the pair against
                  the left edge instead of centring them in the leftover room. */}
                <div className="grid justify-start gap-3 sm:grid-cols-[repeat(2,minmax(0,14rem))]">
                  {result.teams.map((team, index) => (
                    <div
                      key={index}
                      className="glass-panel overflow-hidden"
                      style={{ borderTopColor: teamTone(index).edge }}
                    >
                      {/* The team's hue as a light source above the panel rather
                        than a stripe beside it: colour arriving through the
                        glass is what ties the two ideas together. */}
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-24"
                        style={{
                          background: `linear-gradient(to bottom, ${teamTone(index).wash}, transparent)`,
                        }}
                        aria-hidden="true"
                      />
                      <div className="relative flex flex-col gap-2 p-4">
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
                              className="hover:border-base-content/15 hover:bg-base-content/5 focus:border-primary/50 focus:bg-base-content/5 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold transition-colors duration-150 focus:outline-none"
                              value={teamNames[index] ?? ''}
                              placeholder={`Team ${index + 1}`}
                              onChange={(e) =>
                                setTeamNames({ ...teamNames, [index]: e.target.value })
                              }
                              aria-label={`Name for team ${index + 1}`}
                            />
                          </label>
                          <span className="bg-base-content/8 text-base-content/70 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                            {team.length}
                          </span>
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

                {/* One way out of this page for every team count. The two-team
                    case used to swap in a different panel with its own small
                    "Set up" button, so the button moved and changed shape
                    depending on how many teams came back. */}
                <Link
                  to={paths.quickStart}
                  state={{
                    names: result.teams.map((_, i) => nameFor(i)),
                    squads: result.teams.map((team, i) => ({
                      label: nameFor(i),
                      members: team.map((p) => p.name),
                    })),
                  }}
                  className={ACTION_BUTTON}
                >
                  <ActionSheen />
                  <Link2 className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-rotate-12" />
                  Put these teams in a bracket
                </Link>
              </div>
            ) : (
              <div className="border-base-content/12 text-base-content/40 flex h-full min-h-[16rem] items-center justify-center rounded-[1.25rem] border border-dashed p-8 text-center text-sm">
                Your teams will appear here.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
