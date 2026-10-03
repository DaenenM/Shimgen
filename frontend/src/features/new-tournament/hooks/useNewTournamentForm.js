import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { tournaments as tournamentsApi } from '@/api/endpoints'
import { byeWarning } from '@/features/bracket/utils/byes'
import { useRoster } from '@/features/roster/hooks/useRoster'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

import { buildTournamentPayload } from '../utils/payload'

const BLANK_TEAMS = [
  { label: '', members: [] },
  { label: '', members: [] },
]

// New-tournament form state, derived values, and the create mutation. Used by QuickStartPage.jsx.
export function useNewTournamentForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { touchLocal } = useRoster()

  // Arriving with squads from the team generator opens the form in team mode, pre-filled.
  const incoming = location.state?.squads ?? null

  const [mode, setMode] = useState(incoming ? 'teams' : 'solo')
  // Source of truth for solo/captains mode; the list is just this text parsed.
  const [rosterText, setRosterText] = useState((location.state?.names ?? []).join('\n'))
  const [teams, setTeams] = useState(incoming ?? BLANK_TEAMS)
  // Which team a roster click fills, in teams mode.
  const [activeTeam, setActiveTeam] = useState(0)
  // Captains are drawn from the players box, so captains mode reuses the solo entry UI.
  const [captains, setCaptains] = useState({ count: 2, mode: 'random', chosen: [] })

  const [title, setTitle] = useState('')
  const [game, setGame] = useState('')
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

  // A team is one entrant regardless of size. In captains mode the entrants are the
  // draft's future teams, not the pool of typed players.
  const entrantCount =
    mode === 'teams' ? teams.length : mode === 'captains' ? captains.count : names.length

  // Everyone already placed, so the roster can show them as taken.
  const placed = mode === 'teams' ? teams.flatMap((t) => t.members) : names

  const blocker = whyNotReady({ mode, teams, names, captains, entrantCount })

  const create = useMutation({
    meta: { errorShown: true },
    mutationFn: () =>
      tournamentsApi.create(
        buildTournamentPayload({
          title,
          game,
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

      // Invalidate so the tournaments list picks up the newly created one.
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })

      // Captains mode has no bracket yet -- go to the draft lobby instead.
      navigate(
        mode === 'captains'
          ? paths.draft(tournament.id, tournament.title)
          : paths.tournament(tournament.id, tournament.title),
      )
    },
  })

  // Drop a saved team into the form. Fills the first empty slot rather than appending,
  // so the two starting blank teams get used before the list grows. Members come across
  // as names (what entrant_teams carries) -- the server re-matches them on creation.
  function addSavedTeam(team) {
    const filled = { label: team.name, members: team.members.map((m) => m.display_name) }

    setTeams((current) => {
      const blank = current.findIndex((t) => !t.label.trim() && t.members.length === 0)
      if (blank === -1) return [...current, filled]
      return current.map((t, index) => (index === blank ? filled : t))
    })
  }

  // Change entry mode, carrying players across. Leaving teams mode moves every team
  // member into the players box (skipping duplicates); the teams themselves are kept,
  // so switching back to teams mode finds them unchanged.
  function changeMode(next) {
    if (mode === 'teams' && next !== 'teams') {
      const seen = new Set(names.map((n) => n.toLowerCase()))
      const incomingNames = []
      for (const name of teams.flatMap((t) => t.members)) {
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        incomingNames.push(name)
      }
      if (incomingNames.length > 0) setRosterText([...names, ...incomingNames].join('\n'))
    }
    setMode(next)
  }

  // Put a roster name into the players box, or into the active team.
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

  // Take a roster name back out, so a click in the saved roster undoes itself.
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
    setMode: changeMode,
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
    game,
    setGame,
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
    // Byes are correct/standard but can look broken to a host before play starts.
    warning: byeWarning(format, entrantCount),
    blocker,
    create,
    addSavedTeam,
    addFromRoster,
    removeFromRoster,
  }
}

// Why the form can't submit yet (shown under the button), or null when it can --
// these are all cases the server would otherwise reject.
function whyNotReady({ mode, teams, names, captains, entrantCount }) {
  // Need more players than captains, or the draft has nobody left to pick.
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
  // An empty team is a bracket slot the bracket can't resolve.
  if (mode === 'teams' && teams.some((t) => t.members.length === 0)) {
    return 'Every team needs at least one player.'
  }
  return null
}
