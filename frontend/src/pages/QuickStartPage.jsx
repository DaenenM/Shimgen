import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Info, Trophy, Users } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { boards as boardsApi, tournaments as tournamentsApi } from '@/api/endpoints'
import { PageHeader } from '@/components/ui/PageHeader'
import { FriendPicker } from '@/components/ui/FriendPicker'
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
  const [names, setNames] = useState(location.state?.names ?? [])
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
  // Friends who may report results alongside the host.
  const [cohosts, setCohosts] = useState([])
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
        ...(statsBoard ? { stats_board: statsBoard } : {}),
        // Reporting rights from the start: by the time the first match ends,
        // nobody wants to be in a settings screen (plan §4, NEW 12).
        ...(cohosts.length > 0 ? { cohosts } : {}),
        settings: {
          best_of: { default: bestOf },
          ...(format === 'double' ? { bracket_reset: bracketReset } : {}),
        },
      }),
    onSuccess: (tournament) => {
      touchLocal(mode === 'teams' ? teams.flatMap((t) => t.members) : names)
      navigate(paths.tournament(tournament.id, tournament.title))
    },
  })

  // Only boards the host may write to: linking to one you cannot edit would be
  // refused by the server, so it should not be offered.
  const editableBoards = (boardList?.results ?? boardList ?? []).filter(
    (board) => board.role === 'owner' || board.role === 'editor',
  )

  const isElimination = format === 'single' || format === 'double'
  // One entrant count for both modes: a team is one entrant regardless of how
  // many people are in it, so the bracket maths is identical.
  const entrantCount = mode === 'teams' ? teams.length : names.length
  const warning = byeWarning(format, entrantCount)

  // Every team needs at least one player — an empty team is a bracket slot
  // with nobody in it, which the bracket cannot resolve.
  const emptyTeams = mode === 'teams' && teams.some((t) => t.members.length === 0)
  const canCreate = entrantCount >= 2 && !emptyTeams

  // Everyone already placed, so the roster can show them as taken. In teams
  // mode that spans every team — nobody plays for two sides at once.
  const placed = mode === 'teams' ? teams.flatMap((t) => t.members) : names

  /** Put a roster name into the list, or into the team being filled. */
  function addFromRoster(name) {
    if (mode !== 'teams') {
      setNames((current) => [...current, name])
      return
    }

    setTeams((current) =>
      current.map((team, index) =>
        index === activeTeam ? { ...team, members: [...team.members, name] } : team,
      ),
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
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
        <SavedRoster
          selected={placed}
          onAdd={addFromRoster}
          title={mode === 'teams' ? `Add to team ${activeTeam + 1}` : 'Saved roster'}
        />

        <div className="card bg-base-100 border-base-300 min-w-0 border">
          <div className="card-body gap-5">
            <label className="flex w-full flex-col">
              <span className="label-text mb-1">
                Title <span className="text-base-content/40">(optional)</span>
              </span>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Saturday Pummel Party"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            {/* Solo is a flat list of players. Teams is for a crew whose sides
              are already settled and just need writing down, rather than
              randomising. */}
            <div>
              <div className="border-base-300 bg-base-200/40 mb-4 inline-flex rounded-xl border p-1">
                {[
                  ['solo', 'Solo players'],
                  ['teams', 'Teams'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors duration-150 ${
                      mode === value
                        ? 'bg-primary text-primary-content'
                        : 'text-base-content/60 hover:text-base-content'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === 'teams' ? (
                <TeamBuilder
                  teams={teams}
                  onChange={setTeams}
                  activeTeam={activeTeam}
                  onFocusTeam={setActiveTeam}
                />
              ) : (
                <RosterPicker selected={names} onChange={setNames} />
              )}
            </div>
          </div>
        </div>

        <div className="card bg-base-100 border-base-300 min-w-0 border lg:sticky lg:top-20">
          <div className="card-body gap-5">
            {/* Format */}
            <div>
              <span className="text-sm font-medium">Format</span>
              <div className="mt-2 grid gap-2">
                {FORMATS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      format === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-base-300 hover:border-base-content/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      className="radio radio-primary radio-sm mt-0.5"
                      checked={format === option.value}
                      onChange={() => setFormat(option.value)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="text-base-content/50 block text-xs">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="grid gap-4">
              <label className="flex w-full flex-col">
                <span className="label-text mb-1">Games per match</span>
                <select
                  className="select select-bordered w-full"
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
                    : `Every matchup is a best-of-${bestOf} series — first to ${
                        Math.floor(bestOf / 2) + 1
                      } wins${isElimination ? ' advances' : ''}.`}
                </span>
              </label>

              <div className="flex flex-col justify-end gap-2">
                {format === 'single' && (
                  <label className="flex w-full cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm mt-0.5 shrink-0"
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
                      className="checkbox checkbox-primary checkbox-sm mt-0.5 shrink-0"
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

            {isAuthenticated && (
              <div className="border-base-300 bg-base-200/30 rounded-xl border p-3">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Who else can report results
                </span>
                <p className="text-base-content/50 mt-0.5 mb-2 text-xs">
                  So you are not the only one entering scores all night.
                </p>

                <FriendPicker
                  selected={cohosts}
                  onToggle={(person) =>
                    setCohosts((current) =>
                      current.includes(person.id)
                        ? current.filter((id) => id !== person.id)
                        : [...current, person.id],
                    )
                  }
                  emptyHint="Add someone as a friend first, then they can help run your brackets."
                />
              </div>
            )}

            {/* Linking to a board is what makes a league night count for
                something past Saturday. Signed-in only, since an anonymous
                bracket has no board of its own to feed. */}
            {isAuthenticated && (
              <div className="border-base-300 bg-base-200/30 rounded-xl border p-3">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  Count towards a board
                </span>
                <p className="text-base-content/50 mt-0.5 mb-2 text-xs">
                  Credited to each player, never to the team name.
                </p>

                {makingBoard ? (
                  // Only a name is asked for. A board made from here is always
                  // a tournament board, so the kind is not a question worth
                  // interrupting the form to ask.
                  <div className="flex gap-2">
                    <input
                      className="input input-bordered input-sm min-w-0 flex-1 rounded-lg"
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
                      className="btn btn-primary btn-sm"
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
                      className="btn btn-ghost btn-sm"
                      onClick={() => setMakingBoard(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <select
                    className="select select-bordered select-sm w-full rounded-lg"
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
                    <option value="">No board</option>
                    {editableBoards.map((board) => (
                      <option key={board.slug} value={board.slug}>
                        {board.name}
                      </option>
                    ))}
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
              <div className="alert bg-base-100 border-base-300 items-start border py-2 text-sm">
                <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>{warning.message}</p>
                  <p className="text-base-content/50 mt-0.5 text-xs">{warning.hint}</p>
                </div>
              </div>
            )}

            {create.isError && (
              <div role="alert" className="alert alert-error py-2 text-sm">
                {create.error.message}
              </div>
            )}

            <button
              className="btn btn-primary btn-lg gap-2"
              disabled={!canCreate || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <Trophy className="h-5 w-5" />
              )}
              Create tournament
            </button>

            {!canCreate && (
              <p className="text-base-content/50 -mt-3 text-center text-xs">
                {entrantCount < 2
                  ? `Add at least two ${mode === 'teams' ? 'teams' : 'players'}.`
                  : 'Every team needs at least one player.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
