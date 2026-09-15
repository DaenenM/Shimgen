import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, RotateCcw, Share2, Shuffle, Users } from '@/components/icons'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { useDraftSocket } from '@/hooks/useDraftSocket'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * The captain draft: a pool of players, and captains taking turns to pick.
 *
 * This page exists because a drafted tournament has no bracket yet — entrants
 * are created only once every player has a team, so there is nothing for the
 * bracket page to render until the draft ends. Step 6 of the flow: the last
 * pick makes this page redundant and it hands over to the bracket.
 *
 * One device, passed around the room. Whoever is captain taps their own pick,
 * or the host taps for them — which is how a group at one table actually
 * drafts, and it needs no accounts at all, so an anonymous quick-start host can
 * use captains mode like anyone else. Live joining is a later pass; the
 * captain's account is already recorded server-side for it.
 */
export function DraftLobbyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const { data: tournament, isLoading } = useQuery({
    queryKey: queryKeys.tournaments.detail(id),
    queryFn: () => tournamentsApi.get(id),
  })

  /**
   * The lobby's own link, for sending straight to the people in the draft.
   *
   * Not a spectator link: this route is gated like any other view of the
   * tournament, so it opens only for the host, a captain, or somebody in the
   * pool. It saves them hunting through their tournament list, and nothing
   * more — anyone without access still cannot see it.
   *
   * Declared after the query it reads: `tournament` is a `const`, so referring
   * to it above its own declaration is a temporal dead zone error rather than
   * an undefined — it throws on first render.
   */
  const lobbyUrl = `${window.location.origin}${paths.draft(id, tournament?.title)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(lobbyUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied; nothing is lost, the URL is in the bar.
    }
  }

  const { data: draft } = useQuery({
    queryKey: queryKeys.tournaments.draft(id),
    queryFn: () => tournamentsApi.draft(id),
    // The pool moves on every pick and a stale lobby shows a player who has
    // already been taken — the one thing that would make two captains pick the
    // same person.
    staleTime: 0,
    // No polling: the socket below pushes every change. This query exists to
    // paint the page before the socket has connected, and as the fallback if it
    // never does.
  })

  // Everyone watching converges on one server-rendered payload. The socket is
  // read-only — picks still go through the REST endpoint, which owns the turn
  // check — so this only ever writes what the server has already decided.
  useDraftSocket(id, (next) => queryClient.setQueryData(queryKeys.tournaments.draft(id), next))

  const key = queryKeys.tournaments.draft(id)

  /**
   * A pick lands the instant it is tapped.
   *
   * A draft is a room of people watching one screen, and a name that sits still
   * for a round trip before moving reads as a missed tap — so the next person
   * taps again. The cache is written synchronously here and the request
   * follows; the server's own response replaces it when it arrives.
   *
   * The transition is applied exactly as the server applies it — name out of
   * the pool, onto the picking team, turn advanced — so the optimistic view and
   * the confirmed one agree. Anything less and the screen would flicker as the
   * response corrected it.
   */
  const pick = useMutation({
    mutationFn: (label) => tournamentsApi.draftPick(id, label),
    onMutate: (label) => {
      const previous = queryClient.getQueryData(key)
      if (!previous) return { previous }

      const position = previous.current_team
      const picksMade = previous.picks_made + 1

      queryClient.setQueryData(key, {
        ...previous,
        pool: previous.pool.filter((name) => name !== label),
        picks_made: picksMade,
        picks_remaining: Math.max(0, previous.picks_remaining - 1),
        // Read from the stored rotation rather than guessed: the order is not
        // a simple increment once it wraps, and the server is the one that
        // decided it.
        current_team: previous.pick_order?.[picksMade] ?? null,
        teams: previous.teams.map((team) => ({
          ...team,
          members: team.position === position ? [...team.members, label] : team.members,
          is_picking: team.position === (previous.pick_order?.[picksMade] ?? null),
        })),
      })

      // Not awaited: React Query holds the mutation until onMutate resolves, so
      // awaiting the abort would put the round trip back in front of the tap —
      // the exact delay this exists to remove.
      queryClient.cancelQueries({ queryKey: key })

      return { previous }
    },
    // The server is the authority on what actually happened — a name someone
    // else took first comes back corrected here.
    onSuccess: (next) => queryClient.setQueryData(key, next),
    onError: (_error, _label, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
  })

  const undo = useMutation({
    mutationFn: () => tournamentsApi.draftUndo(id),
    onMutate: () => {
      const previous = queryClient.getQueryData(key)
      if (!previous || previous.picks_made === 0) return { previous }

      const picksMade = previous.picks_made - 1
      // Whose pick is being taken back — the turn *before* the current one.
      const position = previous.pick_order?.[picksMade] ?? null
      const undone = previous.teams.find((team) => team.position === position)
      // The captain leads `members` and is not a pick, so the last entry is the
      // only thing an undo can remove.
      const restored = undone?.members?.[undone.members.length - 1]

      queryClient.setQueryData(key, {
        ...previous,
        pool: restored ? [...previous.pool, restored] : previous.pool,
        picks_made: picksMade,
        picks_remaining: previous.picks_remaining + 1,
        current_team: position,
        teams: previous.teams.map((team) => ({
          ...team,
          members:
            team.position === position && team.members.length > 1
              ? team.members.slice(0, -1)
              : team.members,
          is_picking: team.position === position,
        })),
      })

      queryClient.cancelQueries({ queryKey: key })

      return { previous }
    },
    onSuccess: (next) => queryClient.setQueryData(key, next),
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
  })

  const complete = useMutation({
    mutationFn: () => tournamentsApi.draftComplete(id),
    onSuccess: (finished) => {
      // The bracket now exists, so both the list and this tournament's own
      // cached copy are out of date.
      queryClient.setQueryData(queryKeys.tournaments.detail(id), finished)
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
      navigate(paths.tournament(finished.id, finished.title))
    },
  })

  /**
   * A finished draft is not a page, it is a redirect.
   *
   * Everyone watching the lobby is told the moment the last pick lands — the
   * socket carries `completed_at` — and the only useful thing to show them is
   * the bracket the draft just produced. An interstitial saying "this draft is
   * finished, click here" made every spectator take a manual step to see the
   * thing they were waiting for.
   *
   * `replace` so the back button leaves the tournament rather than bouncing
   * through a lobby that no longer exists.
   */
  useEffect(() => {
    if (!draft?.completed_at) return

    // Refetch the bracket before handing over to it. Everyone watching the
    // lobby already holds a cached copy of this tournament from *during* the
    // draft — when it genuinely had no entrants and no matches — and with a
    // two-minute staleTime plus `placeholderData`, the bracket page would paint
    // that empty copy and sit there saying "No bracket yet" over a bracket that
    // exists.
    //
    // The host never saw it: `draft_complete`'s own onSuccess writes the fresh
    // tournament into their cache. This is everyone else.
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.standings(id) })

    navigate(paths.tournament(id, tournament?.title), { replace: true })
  }, [draft?.completed_at, id, tournament?.title, navigate, queryClient])

  if (isLoading || !draft) return <SkeletonPage width="max-w-4xl" />

  // Only the irreversible step waits on the network. Picking and undoing are
  // applied to the cache immediately, so disabling them while a request is in
  // flight would reintroduce the pause this page is meant not to have — and a
  // fast run of picks is exactly the normal case.
  const busy = complete.isPending
  const ready = draft.pool.length === 0
  // Building the bracket is a host action on the server, so the control is a
  // host control here. A captain picks; only the host ends the draft.
  const isHost = Boolean(tournament?.is_host)
  const current = draft.teams.find((team) => team.is_picking)
  const error = pick.error ?? undo.error ?? complete.error

  return (
    <PageShell width="wide" className="glass-backdrop">
      <Link
        to={paths.tournaments}
        className="text-base-content/60 hover:text-base-content rise-in rise-delay-1 mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All tournaments
      </Link>

      <div className="rise-in rise-delay-2 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {tournament?.title || 'Team draft'}
          </h1>

          {/* The turn indicator is the most important thing on the page: with one
            device being passed around, whoever is holding it needs to know at a
            glance whether it is their turn. */}
          <p className="text-base-content/60 mt-1 text-sm">
            {ready ? (
              <>Every player has a team. Review the sides below, then build the bracket.</>
            ) : (
              <>
                <span className="text-primary font-semibold">{current?.captain_label}</span> picks —{' '}
                {draft.picks_remaining} left
              </>
            )}
          </p>
        </div>

        {/* A friend added to the pool has no way of knowing until their own
            browser asks again, so handing them the link beats telling them to
            go and look. */}
        <button
          className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] sm:px-4"
          onClick={copyLink}
          title="Copy a link to this lobby for the people in the draft"
          aria-label={copied ? 'Lobby link copied' : 'Share lobby'}
        >
          {copied ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <Share2 className="h-4 w-4 shrink-0" />
          )}
          <span className="hidden sm:inline">{copied ? 'Link copied' : 'Share lobby'}</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="border-error/30 bg-error/12 text-error rise-in rise-delay-2 mb-4 rounded-xl border px-3 py-2 text-sm"
        >
          {error.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* ── The pool ──────────────────────────────────────────────────── */}
        <div className="rise-in rise-delay-3 self-start">
          <div className="glass-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Users className="h-4 w-4" />
                Available
                <span className="text-base-content/50">({draft.pool.length})</span>
              </span>

              {draft.picks_made > 0 && (
                <button
                  type="button"
                  onClick={() => undo.mutate()}
                  disabled={busy}
                  className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30"
                  title="Undo the last pick"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Undo
                </button>
              )}
            </div>

            {draft.pool.length === 0 ? (
              <p className="text-base-content/50 py-6 text-center text-sm">
                Everyone has been picked.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {draft.pool.map((name) => (
                  // A pick is one tap on the name itself — no select-then-confirm.
                  // The draft is the one moment where everyone is watching the
                  // screen, and a second step per pick is felt by the whole room.
                  <button
                    key={name}
                    type="button"
                    onClick={() => pick.mutate(name)}
                    disabled={busy}
                    className="glass-raised hover:border-primary/50 hover:text-primary h-9 rounded-full px-3.5 text-sm font-medium transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── The teams ─────────────────────────────────────────────────── */}
        <div className="rise-in rise-delay-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {draft.teams.map((team, index) => (
              <div
                key={team.id}
                className={`glass-panel p-4 transition-all duration-200 ${
                  team.is_picking ? 'border-primary/50 shadow-primary/20 shadow-lg' : ''
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {team.label || `${team.captain_label}'s team`}
                  </span>

                  {team.is_picking && (
                    <span className="bg-primary/15 text-primary shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
                      Picking
                    </span>
                  )}
                </div>

                <ul className="space-y-1">
                  {team.members.map((member, position) => (
                    <li
                      key={member}
                      className="flex items-center gap-2 text-sm"
                      // The captain is first in `members` and is not a pick —
                      // marking them keeps the list honest about who chose whom.
                      title={position === 0 ? 'Captain' : undefined}
                    >
                      {position === 0 ? (
                        <span className="text-primary text-xs font-bold">C</span>
                      ) : (
                        <span className="text-base-content/30 text-xs">{position}</span>
                      )}
                      <span className="truncate">{member}</span>
                    </li>
                  ))}

                  {/* Empty slots, so a team that is a player short is visible
                      before the final pick rather than after it. */}
                  {Array.from({
                    length: Math.max(0, (draft.expected_sizes?.[index] ?? 0) - team.members.length),
                  }).map((_, slot) => (
                    <li
                      key={`empty-${slot}`}
                      className="text-base-content/25 flex items-center gap-2 text-sm italic"
                    >
                      <span className="text-xs">·</span>
                      empty
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Confirmation rather than auto-generating on the final pick: the
              last tap of a draft is the one most likely to be a misclick, and
              building the bracket is not undoable from here.

              Host only. Completing the draft creates the entrants and generates
              the bracket — `draft_complete` is gated on IsTournamentHost, so
              for anybody else the button was an action that could only fail.
              Everyone else gets the state instead of the control. */}
          <div className="mt-5">
            {isHost ? (
              <Button
                icon={ready ? Check : Shuffle}
                onClick={() => complete.mutate()}
                disabled={!ready || busy}
                loading={complete.isPending}
              >
                {ready ? 'Build the bracket' : `${draft.picks_remaining} picks to go`}
              </Button>
            ) : ready ? (
              // Green because it is the one moment in the draft that is simply
              // good news: every team is settled and the bracket is moments
              // away. The redirect fires on its own when the host builds it, so
              // this says "wait" without asking anyone to do anything.
              <div className="border-success/30 bg-success/10 flex items-start gap-3 rounded-xl border p-4">
                <span className="bg-success/15 text-success grid h-9 w-9 shrink-0 place-items-center rounded-full">
                  <Check className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-success text-sm font-semibold">Draft complete</p>
                  <p className="text-base-content/60 mt-0.5 text-sm">
                    Every player has a team. The bracket opens here as soon as the host builds it.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-base-content/50 text-sm">
                {draft.picks_remaining} {draft.picks_remaining === 1 ? 'pick' : 'picks'} to go.
              </p>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
