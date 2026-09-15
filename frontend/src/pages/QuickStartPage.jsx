import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Info, Minus, Plus, Trophy } from '@/components/icons'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { boards as boardsApi, tournaments as tournamentsApi } from '@/api/endpoints'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { RosterPicker } from '@/components/ui/RosterPicker'
import { SavedRoster } from '@/components/ui/SavedRoster'
import { TeamBuilder } from '@/components/ui/TeamBuilder'
import { byeWarning } from '@/features/bracket/byes'
import { useAuth } from '@/hooks/useAuth'
import { useRoster } from '@/hooks/useRoster'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

const FORMATS = [
  { value: 'single', label: 'Single elimination', hint: 'One loss and you are out.' },
  { value: 'double', label: 'Double elimination', hint: 'Losers bracket, second chance.' },
  { value: 'rr', label: 'Round robin', hint: 'Everyone plays everyone.' },
  { value: 'swiss', label: 'Swiss', hint: 'Paired on score, nobody eliminated.' },
  { value: 'ffa', label: 'Free-for-all', hint: 'Lobbies, points by placement.' },
]

const BEST_OF = [1, 3, 5, 7]

// A select value that cannot collide with a board slug, so "make a new one" can
// live in the same control as the boards themselves.
const NEW_BOARD = '__new__'

// Joins a board slug to a table id in one option value, since a <select> can
// only carry a string. A slug is generated from an alphabet without this
// character, so it cannot appear in the first half by accident.
const TABLE_SEPARATOR = '::'

/**
 * Build a tournament, with or without an account.
 *
 * Nothing here requires a login (plan §4, NEW 6). An anonymous bracket comes
 * back with a claim token, so it can be attached to an account afterwards.
 */
export function QuickStartPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { touchLocal } = useRoster()
  const queryClient = useQueryClient()

  // The team generator can hand teams straight over, so arriving with squads
  // opens the form already in team mode with them filled in.
  const incoming = location.state?.squads ?? null

  const [mode, setMode] = useState(incoming ? 'teams' : 'solo')
  // Captains mode: how many sides, and who leads them. The players box stays
  // the source of truth — captains are drawn *from* that list, which is why
  // this mode reuses the solo entry UI rather than adding its own.
  const [captainTeams, setCaptainTeams] = useState(2)
  const [captainMode, setCaptainMode] = useState('random')
  const [chosenCaptains, setChosenCaptains] = useState([])
  // The players box is the source of truth for solo mode, and it is text: the
  // picker is a textarea, so the list only exists as parsed output of it.
  const [rosterText, setRosterText] = useState((location.state?.names ?? []).join('\n'))
  const [teams, setTeams] = useState(
    incoming ?? [
      { label: '', members: [] },
      { label: '', members: [] },
    ],
  )
  const [title, setTitle] = useState('')
  const [format, setFormat] = useState('single')
  const [bestOf, setBestOf] = useState(1)
  const [thirdPlace, setThirdPlace] = useState(false)
  const [bracketReset, setBracketReset] = useState(false)
  // Which team a roster click fills. Teams mode has several targets, so one has
  // to be current — otherwise clicking a name would have nowhere to go.
  const [activeTeam, setActiveTeam] = useState(0)

  const names = useMemo(
    () =>
      rosterText
        .split(/[\n,]/)
        .map((n) => n.trim())
        .filter(Boolean),
    [rosterText],
  )

  // Boards the host may write to, so a night's winner can land on a tally
  // board as well as a bracket. Only offered signed in — an anonymous bracket
  // has no board to attach to.
  const { isAuthenticated } = useAuth()
  const { data: boardList } = useQuery({
    queryKey: queryKeys.boards.all,
    queryFn: boardsApi.list,
    enabled: isAuthenticated,
  })

  const [statsBoard, setStatsBoard] = useState('')
  const [makingBoard, setMakingBoard] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')

  /**
   * Make a board without leaving the form.
   *
   * Always a tournament board: it exists to receive this bracket's results, so
   * asking whether it should be hand-counted would be offering an answer that
   * cannot be right. Selected on success, which is the only reason to have made
   * it.
   */
  const createBoard = useMutation({
    mutationFn: () => boardsApi.create({ name: newBoardName.trim(), tracks_tournaments: true }),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all })
      setStatsBoard(board.slug)
      setMakingBoard(false)
      setNewBoardName('')
    },
  })

  const create = useMutation({
    mutationFn: () =>
      tournamentsApi.create({
        title: title.trim(),
        format,
        // Teams carry their members so the bracket can show who is on each
        // side; a plain list of names has nobody to attach. An unnamed team
        // falls back to its position, so a host can fill in players and leave
        // the naming alone.
        ...(mode === 'teams'
          ? {
              entrant_teams: teams.map((team, index) => ({
                label: team.label.trim() || `Team ${index + 1}`,
                members: team.members,
              })),
            }
          : { entrant_labels: names }),
        third_place_match: thirdPlace,
        // Where results land. Everyone on the winning entrant is credited
        // individually — a 3v3 win is three people's win — which the server
        // handles.
        //
        // A value carrying a table id names that table outright; a bare slug
        // lets the server pick, which is right when the board has only one.
        ...(statsBoard
          ? statsBoard.includes(TABLE_SEPARATOR)
            ? { stats_table: Number(statsBoard.split(TABLE_SEPARATOR)[1]) }
            : { stats_board: statsBoard }
          : {}),
        settings: {
          best_of: { default: bestOf },
          ...(format === 'double' ? { bracket_reset: bracketReset } : {}),
          // Captains mode sends no entrants at all — just the pool and how to
          // split it. The server opens a draft instead of building a bracket,
          // and the entrants appear when the last player is picked.
          ...(mode === 'captains'
            ? {
                team_draft: {
                  team_count: captainTeams,
                  captain_mode: captainMode,
                  ...(captainMode === 'manual' ? { captains: chosenCaptains } : {}),
                },
              }
            : {}),
        },
      }),
    onSuccess: (tournament) => {
      touchLocal(mode === 'teams' ? teams.flatMap((t) => t.members) : names)

      // The tournaments list is now out of date. Without this it keeps serving
      // the cached copy — which does not contain the bracket just created — so
      // the new tournament appeared to be missing until a hard refresh.
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })

      // A drafted tournament has no bracket yet, so the bracket page would show
      // an empty one. The lobby is where it actually continues.
      navigate(
        mode === 'captains'
          ? paths.draft(tournament.id, tournament.title)
          : paths.tournament(tournament.id, tournament.title),
      )
    },
  })

  // Only boards the host may write to, and only boards built to receive a
  // tournament.
  //
  // Linking a hand-counted board does not merely record alongside the tally —
  // it gives that table the four automatic columns a bracket fills, which is a
  // structural change to a board somebody made to count by hand. Offering it
  // and then silently rewriting it is the worse half of that; leaving it out of
  // the list keeps the board the thing its owner built.
  const editableBoards = (boardList?.results ?? boardList ?? []).filter(
    (board) => (board.role === 'owner' || board.role === 'editor') && board.tracks_tournaments,
  )

  const isElimination = format === 'single' || format === 'double'
  // One entrant count for every mode: a team is one entrant regardless of how
  // many people are in it, so the bracket maths is identical. In captains mode
  // the entrants are the teams the draft will produce — the players typed in
  // are the pool those teams get drawn from, not entrants themselves.
  const entrantCount =
    mode === 'teams' ? teams.length : mode === 'captains' ? captainTeams : names.length
  const warning = byeWarning(format, entrantCount)

  // Every team needs at least one player — an empty team is a bracket slot
  // with nobody in it, which the bracket cannot resolve.
  const emptyTeams = mode === 'teams' && teams.some((t) => t.members.length === 0)

  // A draft needs a captain per team plus somebody left to pick. Exactly one
  // player per team is a valid split but an empty draft — every captain leads
  // a team of one and nobody ever picks — so the pool has to be non-empty.
  const shortPool = mode === 'captains' && names.length <= captainTeams
  // Manual captains must all be named before the lobby can open; the server
  // refuses a partial list, and finding that out after pressing Create is a
  // worse way to learn it.
  const missingCaptains =
    mode === 'captains' && captainMode === 'manual' && chosenCaptains.length !== captainTeams

  const canCreate = entrantCount >= 2 && !emptyTeams && !shortPool && !missingCaptains

  // Everyone already placed, so the roster can show them as taken. In teams
  // mode that spans every team — nobody plays for two sides at once.
  const placed = mode === 'teams' ? teams.flatMap((t) => t.members) : names

  /** Put a roster name into the players box, or into the team being filled. */
  function addFromRoster(name) {
    if (mode !== 'teams') {
      setRosterText((current) =>
        current.trim() ? `${current.replace(/\s+$/, '')}\n${name}` : name,
      )
      return
    }

    setTeams((current) =>
      current.map((team, index) =>
        index === activeTeam ? { ...team, members: [...team.members, name] } : team,
      ),
    )
  }

  /**
   * Take a roster name back out again, so a click in the saved roster undoes
   * itself. Without this the picker's toggle calls an undefined handler and
   * an added name can only be removed by editing the text by hand.
   */
  function removeFromRoster(name) {
    if (mode !== 'teams') {
      const key = name.toLowerCase()
      setRosterText(names.filter((n) => n.toLowerCase() !== key).join('\n'))
      return
    }

    setTeams((current) =>
      current.map((team) => ({ ...team, members: team.members.filter((m) => m !== name) })),
    )
  }

  return (
    <PageShell className="glass-backdrop">
      <PageHeader
        className="rise-in rise-delay-1"
        title="New tournament"
        description="Add names, pick a format, and you have a bracket. No account needed."
      />

      {/* Two columns rather than one long page. With a dozen teams the format
          choices and the create button were several screens below the fold, so
          the list scrolls inside its own column and the settings stay in
          view. */}
      {/* The roster sits beside the form rather than in it. Inside, it resized
          the container every time the list wrapped, and put the names people
          were about to click below the box they were typing in. */}
      <div className="grid items-start gap-6 lg:grid-cols-[14rem_1fr_20rem]">
        {/* `self-start` travels onto the wrapper with the animation, the same
            way it does on the Team Generator: wrapping makes this div the grid
            item, and without it the roster rail stretches to the row's height. */}
        <div className="rise-in rise-delay-2 self-start">
          <SavedRoster
            selected={placed}
            onAdd={addFromRoster}
            onRemove={removeFromRoster}
            title={mode === 'teams' ? `Add to team ${activeTeam + 1}` : 'Saved roster'}
            glass
          />
        </div>

        <div className="glass-panel rise-in rise-delay-3 min-w-0">
          <div className="flex flex-col gap-5 p-5">
            <label className="flex w-full flex-col">
              <span className="label-text mb-1">
                Title <span className="text-base-content/40">(optional)</span>
              </span>
              <input
                type="text"
                className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-10 w-full px-3 text-sm transition-colors focus:outline-none"
                placeholder="Friday Night Showdown"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            {/* Solo is a flat list of players. Teams is for a crew whose sides
              are already settled and just need writing down, rather than
              randomising. */}
            <div>
              <div className="glass-raised mb-4 inline-flex gap-0.5 rounded-xl p-1">
                {[
                  ['solo', 'Solo players'],
                  ['teams', 'Teams'],
                  // Captains is still a list of solo players — the teams are
                  // what the draft produces, not what the host types. It shares
                  // the solo entry box for exactly that reason.
                  ['captains', 'Team captains'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all duration-150 ${
                      mode === value
                        ? 'bg-primary text-primary-content shadow-[inset_0_1px_0_0_oklch(100%_0_0/0.28),0_2px_10px_-2px_var(--color-primary)]'
                        : 'text-base-content/60 hover:bg-base-content/8 hover:text-base-content'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* The entrant list scrolls inside itself rather than growing the
                  page. Twelve teams used to push the format panel and the
                  create button thousands of pixels down, so choosing a format
                  meant scrolling away from the thing you were editing. Capped
                  against the viewport so it always ends above the fold. */}
              <div className="flex max-h-[calc(100vh-21rem)] flex-col">
                {mode === 'teams' ? (
                  <TeamBuilder
                    teams={teams}
                    onChange={setTeams}
                    activeTeam={activeTeam}
                    onFocusTeam={setActiveTeam}
                  />
                ) : (
                  <RosterPicker
                    value={rosterText}
                    onChange={setRosterText}
                    count={names.length}
                    glass
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rise-in rise-delay-4 min-w-0 lg:sticky lg:top-20">
          <div className="flex flex-col gap-5 p-5">
            {/* Format.

                One row per option with the explanation shown only for the
                chosen one. Five cards each carrying a permanent subtitle cost
                about 350px — a third of the viewport — to describe four
                formats the host was not picking. */}
            {/* Captains: how many sides, and who leads them.

                Sits above Format rather than below it because it decides what
                the entrants *are* — the format then decides how those entrants
                play each other. Both still apply: a drafted set of teams feeds
                single elimination, round robin or any other format exactly as
                typed-in teams would. */}
            {mode === 'captains' && (
              <div>
                <span className="text-sm font-medium">Teams</span>
                <p className="text-base-content/50 mt-0.5 text-xs">
                  Captains are taken out of the player list, then draft the rest between them.
                </p>

                <div className="mt-2 flex items-center gap-3">
                  <div className="glass-raised flex shrink-0 items-center overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setCaptainTeams((n) => Math.max(2, n - 1))}
                      disabled={captainTeams <= 2}
                      aria-label="One team fewer"
                      className="hover:text-primary grid h-9 w-9 place-items-center rounded-l-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <span className="tabular w-10 text-center text-lg font-bold">
                      {captainTeams}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setCaptainTeams((n) => Math.min(Math.max(2, names.length), n + 1))
                      }
                      disabled={captainTeams >= Math.max(2, names.length)}
                      aria-label="One team more"
                      className="hover:text-primary grid h-9 w-9 place-items-center rounded-r-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-base-content/50 min-w-0 text-xs">
                    {names.length > captainTeams
                      ? `${captainTeams} captains draft ${names.length - captainTeams} players.`
                      : 'Add players to see the split.'}
                  </p>
                </div>

                <div className="glass-raised mt-3 inline-flex gap-0.5 rounded-xl p-1">
                  {[
                    ['random', 'Random captains'],
                    ['manual', 'Choose captains'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCaptainMode(value)}
                      aria-pressed={captainMode === value}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                        captainMode === value
                          ? 'bg-primary text-primary-content shadow-[inset_0_1px_0_0_oklch(100%_0_0/0.28),0_2px_10px_-2px_var(--color-primary)]'
                          : 'text-base-content/60 hover:bg-base-content/8 hover:text-base-content'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Chosen from the names already typed rather than a separate
                    field: a captain who is not in the player list is a captain
                    the draft cannot seat. Clicking toggles, and the count caps
                    at the team count so the selection cannot overrun. */}
                {captainMode === 'manual' && (
                  <div className="mt-2.5">
                    {names.length === 0 ? (
                      <p className="text-base-content/50 text-xs">
                        Add players first, then pick which of them captain.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {names.map((name) => {
                          const picked = chosenCaptains.includes(name)
                          const full = chosenCaptains.length >= captainTeams

                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() =>
                                setChosenCaptains((current) =>
                                  current.includes(name)
                                    ? current.filter((n) => n !== name)
                                    : current.length < captainTeams
                                      ? [...current, name]
                                      : current,
                                )
                              }
                              disabled={!picked && full}
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
            )}

            <div>
              <span className="text-sm font-medium">Format</span>
              {/* Individual rounded rows rather than a bordered box of them.
                  A single `glass-inset` frame divided by hairlines reads as a
                  table — the shape a settings list had a decade ago — where
                  every other chooser on the site (the board picker, the
                  permissions list, the mobile sheet) gives each option its own
                  rounded surface and tints the chosen one. */}
              <div className="mt-2 flex flex-col gap-1">
                {FORMATS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                      format === option.value
                        ? 'border-primary/40 bg-primary/12 shadow-primary/10 border shadow-sm'
                        : 'glass-inset hover:border-base-content/25 hover:bg-base-content/5'
                    }`}
                  >
                    {/* The browser's own radio chrome, which `accent-primary`
                        only tints, draws a ring around a smaller inner dot —
                        two concentric circles that read as a form control from
                        a decade ago. `appearance-none` takes that away so the
                        indicator can be a single solid dot.

                        Still a real <input>: it keeps the radiogroup semantics
                        and arrow-key navigation the native control provides,
                        which a styled <div> would have to reimplement. The
                        focus ring is put back by hand, because `appearance-none`
                        removes that too. */}
                    <input
                      type="radio"
                      name="format"
                      // One solid blue dot. `appearance-none` drops the
                      // browser's own chrome; the 1px border then only marks
                      // the empty state, and goes transparent when checked so
                      // the fill has no ring sitting against it. Colouring that
                      // border blue instead left a visible seam where the two
                      // blues met, which is what read as a hard edge.
                      //
                      // The focus outline is put back by hand, because
                      // `appearance-none` removes that too.
                      className="border-base-content/30 checked:bg-primary focus-visible:outline-primary h-3.5 w-3.5 shrink-0 appearance-none rounded-full border transition-all duration-200 checked:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2"
                      checked={format === option.value}
                      onChange={() => setFormat(option.value)}
                    />
                    <span
                      className={`text-sm transition-colors duration-200 ${
                        format === option.value ? 'text-primary font-semibold' : 'font-medium'
                      }`}
                    >
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>

              <p className="text-base-content/50 mt-1.5 text-xs">
                {FORMATS.find((option) => option.value === format)?.hint}
              </p>
            </div>

            {/* Options */}
            <div className="grid gap-4">
              <label className="flex w-full flex-col">
                <span className="label-text mb-1">Games per bracket</span>
                <select
                  className="glass-inset focus:border-primary/50 h-10 w-full px-3 text-sm transition-colors focus:outline-none"
                  value={bestOf}
                  onChange={(e) => setBestOf(Number(e.target.value))}
                >
                  {BEST_OF.map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? 'Single game' : `Best of ${n}`}
                    </option>
                  ))}
                </select>
                {/* The old "Series length" label read like a whole-tournament
                  setting. It is per match, which only needs saying where there
                  is more than one match to play. */}
                <span className="text-base-content/50 mt-1 text-xs">
                  {bestOf === 1
                    ? 'Every matchup is decided by one game.'
                    : `Every matchup is a best-of-${bestOf} series, first to ${
                        Math.floor(bestOf / 2) + 1
                      } wins${isElimination ? ' advances' : ''}.`}
                </span>
              </label>

              <div className="flex flex-col justify-end gap-2">
                {format === 'single' && (
                  <label className="flex w-full cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="accent-primary mt-0.5 h-4 w-4 shrink-0"
                      checked={thirdPlace}
                      onChange={(e) => setThirdPlace(e.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="label-text block">Play for 3rd place</span>
                      <span className="text-base-content/50 block text-xs">
                        An extra match between the last two knocked out.
                      </span>
                    </span>
                  </label>
                )}

                {format === 'double' && (
                  <label className="flex w-full cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="accent-primary mt-0.5 h-4 w-4 shrink-0"
                      checked={bracketReset}
                      onChange={(e) => setBracketReset(e.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="label-text block">Second chance for 1st</span>
                      <span className="text-base-content/50 block text-xs">
                        The losers-bracket team must win the final twice, since their opponent has
                        not lost yet.
                      </span>
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Co-hosts are granted from the bracket page instead. Choosing who
                may help is a decision made once the night is running — someone
                else ends up at the console — not while filling in a form, and a
                friend picker here made an already long setup longer. */}

            {/* Linking to a board is what makes a league night count for
                something past Saturday. Signed-in only, since an anonymous
                bracket has no board of its own to feed. */}
            {isAuthenticated && (
              <div className="glass-inset p-3">
                <span className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  Connect Stats Board
                </span>

                {makingBoard ? (
                  // Only a name is asked for. A board made from here is always
                  // a tournament board, so the kind is not a question worth
                  // interrupting the form to ask.
                  <div className="flex gap-2">
                    <input
                      className="glass-raised focus:border-primary/50 h-9 min-w-0 flex-1 px-3 text-sm transition-colors focus:outline-none"
                      placeholder="Board name"
                      value={newBoardName}
                      autoFocus
                      onChange={(e) => setNewBoardName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newBoardName.trim()) {
                          e.preventDefault()
                          createBoard.mutate()
                        }
                        if (e.key === 'Escape') setMakingBoard(false)
                      }}
                      aria-label="New board name"
                    />
                    <button
                      type="button"
                      className="bg-primary text-primary-content hover:bg-primary/90 grid h-9 shrink-0 place-items-center rounded-lg px-3 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40"
                      disabled={!newBoardName.trim() || createBoard.isPending}
                      onClick={() => createBoard.mutate()}
                    >
                      {createBoard.isPending ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        'Create'
                      )}
                    </button>
                    <button
                      type="button"
                      className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
                      onClick={() => setMakingBoard(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <select
                    className="glass-raised focus:border-primary/50 h-9 w-full px-3 text-sm transition-colors focus:outline-none"
                    value={statsBoard}
                    onChange={(e) => {
                      if (e.target.value === NEW_BOARD) {
                        setMakingBoard(true)
                        return
                      }
                      setStatsBoard(e.target.value)
                    }}
                    aria-label="Stats board"
                  >
                    <option value="">No stat board</option>
                    {/* A board with several tournament tables is listed one
                        table at a time — "Pummel Party — Solo wins". With one
                        table there is nothing to choose between, so the board's
                        own name is the option and the server picks the table. */}
                    {editableBoards.flatMap((board) => {
                      const tables = (board.tables_summary ?? []).filter(
                        (table) => table.tracks_tournaments,
                      )

                      if (tables.length <= 1) {
                        return [
                          <option key={board.slug} value={board.slug}>
                            {board.name}
                          </option>,
                        ]
                      }

                      return tables.map((table) => (
                        <option
                          key={`${board.slug}:${table.id}`}
                          value={`${board.slug}${TABLE_SEPARATOR}${table.id}`}
                        >
                          {board.name} — {table.name}
                        </option>
                      ))
                    })}
                    <option value={NEW_BOARD}>+ New board…</option>
                  </select>
                )}

                {createBoard.isError && (
                  <p className="text-error mt-1.5 text-xs">{createBoard.error.message}</p>
                )}

                {/* No second question about which table. The columns a
                    tournament fills are fixed, so the board knows where its
                    results go. */}
                {statsBoard && !makingBoard && (
                  <p className="text-base-content/50 mt-1.5 text-xs">
                    Adds every player to the board now, then keeps games played, wins and losses up
                    to date as you report results.
                  </p>
                )}
              </div>
            )}

            {/* Byes are correct and standard, but a fresh double-elimination
              bracket with several of them looks broken until play starts. Say
              so before the host commits, rather than after. */}
            {warning && (
              <div className="glass-inset flex items-start gap-2.5 p-3 text-sm">
                <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>{warning.message}</p>
                  <p className="text-base-content/50 mt-0.5 text-xs">{warning.hint}</p>
                </div>
              </div>
            )}

            {create.isError && (
              <div
                role="alert"
                className="border-error/30 bg-error/12 text-error rounded-xl border px-3 py-2 text-sm"
              >
                {create.error.message}
              </div>
            )}

            {/* The one opaque element on the page — everything around it is
                glass, so this reads as the way forward without being bigger. */}
            <button
              className="group bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
              disabled={!canCreate || create.isPending}
              onClick={() => create.mutate()}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
              />
              {create.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <Trophy className="h-4.5 w-4.5 transition-transform duration-200 ease-out group-hover:-rotate-12" />
              )}
              Create tournament
            </button>

            {!canCreate && (
              <p className="text-base-content/50 -mt-3 text-center text-xs">
                {shortPool
                  ? `Add more than ${captainTeams} players — the captains come out of this list, so there has to be somebody left to draft.`
                  : missingCaptains
                    ? `Choose ${captainTeams} captains.`
                    : entrantCount < 2
                      ? `Add at least two ${mode === 'teams' ? 'teams' : 'players'}.`
                      : 'Every team needs at least one player.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
