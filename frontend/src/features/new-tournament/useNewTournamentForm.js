import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { byeWarning } from '@/features/bracket/byes'
import { useRoster } from '@/hooks/useRoster'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

import { buildTournamentPayload } from './payload'

const BLANK_TEAMS = [
  { label: '', members: [] },
  { label: '', members: [] },
]

/**
 * Everything the new-tournament form holds, what it adds up to, and creating
 * the tournament from it.
 */
export function useNewTournamentForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { touchLocal } = useRoster()

  // The team generator can hand teams straight over, so arriving with squads
  // opens the form already in team mode with them filled in.
  const incoming = location.state?.squads ?? null

  const [mode, setMode] = useState(incoming ? 'teams' : 'solo')
  // The players box is the source of truth for solo and captains mode, and it
  // is text: the picker is a textarea, so the list only exists as parsed output
  // of it.
  const [rosterText, setRosterText] = useState((location.state?.names ?? []).join('\n'))
  const [teams, setTeams] = useState(incoming ?? BLANK_TEAMS)
  // Which team a roster click fills. Teams mode has several targets, so one has
  // to be current — otherwise clicking a name would have nowhere to go.
  const [activeTeam, setActiveTeam] = useState(0)
  // Captains mode: how many sides, and who leads them. Captains are drawn
  // *from* the players box, which is why this mode reuses the solo entry UI.
  const [captains, setCaptains] = useState({ count: 2, mode: 'random', chosen: [] })

  const [title, setTitle] = useState('')
  const [format, setFormat] = useState('single')
  const [bestOf, setBestOf] = useState(1)
  const [thirdPlace, setThirdPlace] = useState(false)
  const [bracketReset, setBracketReset] = useState(false)
  const [statsBoard, setStatsBoard] = useState('')

  const names = useMemo(
    () =>
      rosterText
        .split(/[\n,]/)
        .map((n) => n.trim())
        .filter(Boolean),
    [rosterText],
  )

  // One entrant count for every mode: a team is one entrant regardless of how
  // many people are in it, so the bracket maths is identical. In captains mode
  // the entrants are the teams the draft will produce — the players typed in
  // are the pool those teams get drawn from, not entrants themselves.
  const entrantCount =
    mode === 'teams' ? teams.length : mode === 'captains' ? captains.count : names.length

  // Everyone already placed, so the roster can show them as taken. In teams
  // mode that spans every team — nobody plays for two sides at once.
  const placed = mode === 'teams' ? teams.flatMap((t) => t.members) : names

  const blocker = whyNotReady({ mode, teams, names, captains, entrantCount })

  const create = useMutation({
    meta: { errorShown: true },
    mutationFn: () =>
      tournamentsApi.create(
        buildTournamentPayload({
          title,
          format,
          mode,
          teams,
          names,
          bestOf,
          thirdPlace,
          bracketReset,
          statsBoard,
          captains,
        }),
      ),
    onSuccess: (tournament) => {
      touchLocal(placed)

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

  /**
   * Drop a saved team into the form, players and all.
   *
   * Fills the first empty side rather than appending: teams mode starts with
   * two blank teams, so appending would leave those blanks stranded above the
   * ones just added. Only once both are used does this grow the list.
   *
   * The members come across as names, which is what `entrant_teams` carries —
   * the server re-matches those names against the roster when it creates the
   * entrants.
   */
  function addSavedTeam(team) {
    const filled = { label: team.name, members: team.members.map((m) => m.display_name) }

    setTeams((current) => {
      const blank = current.findIndex((t) => !t.label.trim() && t.members.length === 0)
      if (blank === -1) return [...current, filled]
      return current.map((t, index) => (index === blank ? filled : t))
    })
  }

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

  /** Take a roster name back out again, so a click in the saved roster undoes itself. */
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

  return {
    mode,
    setMode,
    rosterText,
    setRosterText,
    names,
    teams,
    setTeams,
    activeTeam,
    setActiveTeam,
    captains,
    setCaptains,
    title,
    setTitle,
    format,
    setFormat,
    bestOf,
    setBestOf,
    thirdPlace,
    setThirdPlace,
    bracketReset,
    setBracketReset,
    statsBoard,
    setStatsBoard,
    placed,
    // Byes are correct and standard, but a fresh double-elimination bracket
    // with several of them looks broken until play starts.
    warning: byeWarning(format, entrantCount),
    blocker,
    create,
    addSavedTeam,
    addFromRoster,
    removeFromRoster,
  }
}

/**
 * Why the form cannot be submitted yet, in words — or null when it can.
 *
 * Said under the button rather than discovered after pressing it: the server
 * would refuse each of these, and finding out from an error is worse.
 */
function whyNotReady({ mode, teams, names, captains, entrantCount }) {
  // A draft needs a captain per team plus somebody left to pick. Exactly one
  // player per team is a valid split but an empty draft — every captain leads
  // a team of one and nobody ever picks — so the pool has to be non-empty.
  if (mode === 'captains' && names.length <= captains.count) {
    return `Add more than ${captains.count} players — the captains come out of this list, so there has to be somebody left to draft.`
  }
  if (
    mode === 'captains' &&
    captains.mode === 'manual' &&
    captains.chosen.length !== captains.count
  ) {
    return `Choose ${captains.count} captains.`
  }
  if (entrantCount < 2) {
    return `Add at least two ${mode === 'teams' ? 'teams' : 'players'}.`
  }
  // An empty team is a bracket slot with nobody in it, which the bracket
  // cannot resolve.
  if (mode === 'teams' && teams.some((t) => t.members.length === 0)) {
    return 'Every team needs at least one player.'
  }
  return null
}
