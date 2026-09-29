import { useCallback, useMemo, useState } from 'react'

import { useRoster } from '@/features/roster/hooks/useRoster'
import { useLocalStorage } from '@/hooks/useLocalStorage'

import { generateTeams } from '../utils/generate'

// Namespaced like the app's other stored values (shim.roster, shim.access).
const STORAGE_KEY = 'shim.team-generator'

// Module-level, not recreated per render: useLocalStorage compares snapshots by identity
// (useSyncExternalStore), so a fresh object each render would loop.
const EMPTY_SETUP = {
  rosterText: '',
  teamCount: 2,
  constraints: [],
  result: null,
  teamNames: {},
}

const EMPTY_DRAFT = { kind: 'apart', a: '', b: '' }

// Parses the textarea's raw text into a name list. Shared by the textarea and staging helpers.
function parseNames(text) {
  return text
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter(Boolean)
}

// Team generator's state and actions. Used by TeamGeneratorPage.jsx.
// The textarea's raw text is the single source of truth for who's playing; `names` is just it parsed.
export function useTeamGenerator() {
  const { touchLocal } = useRoster()

  // Persisted as one record (not separate keys) so a reload restores a coherent setup —
  // otherwise a stored result could reference names no longer on the page.
  const [saved, setSaved] = useLocalStorage(STORAGE_KEY, EMPTY_SETUP)
  const { rosterText, teamCount, constraints, result, teamNames } = saved

  const patch = useCallback(
    (changes) => setSaved((current) => ({ ...current, ...changes })),
    [setSaved],
  )

  // Not persisted: a half-built rule or stale error shouldn't greet a returning host.
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [error, setError] = useState(null)

  const names = useMemo(() => parseNames(rosterText), [rosterText])
  const liveConstraints = constraints.filter((c) => names.includes(c.a) && names.includes(c.b))

  const setRosterText = useCallback(
    (next) =>
      setSaved((current) => ({
        ...current,
        rosterText: typeof next === 'function' ? next(current.rosterText) : next,
      })),
    [setSaved],
  )

  const setTeamCount = useCallback(
    (next) =>
      setSaved((current) => ({
        ...current,
        teamCount: typeof next === 'function' ? next(current.teamCount) : next,
      })),
    [setSaved],
  )

  // "Clear all": resets everything in one assignment so nothing can come back half-cleared
  // (teams/rules referencing players no longer listed).
  const clearEverything = useCallback(() => {
    setSaved(EMPTY_SETUP)
    setDraft(EMPTY_DRAFT)
    setError(null)
  }, [setSaved])

  // Adds a saved name as a new line in the text field, as if typed.
  function stageAdd(name) {
    setRosterText((current) => [...parseNames(current), name].join('\n'))
  }

  // Removes a name by dropping any matching line, case-insensitively.
  function stageRemove(name) {
    setRosterText((current) =>
      parseNames(current)
        .filter((n) => n.toLowerCase() !== name.toLowerCase())
        .join('\n'),
    )
  }

  function generate() {
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

      patch({
        result: { teams: teams.map((team) => team.map((p) => ({ id: p.id, name: p.name }))) },
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
    if (!exists) patch({ constraints: [...constraints, { kind: draft.kind, a, b }] })

    setDraft({ kind: draft.kind, a: '', b: '' })
  }

  function removeConstraint(rule) {
    patch({
      constraints: constraints.filter(
        (x) => !(x.kind === rule.kind && x.a === rule.a && x.b === rule.b),
      ),
    })
  }

  const renameTeam = (index, name) => patch({ teamNames: { ...teamNames, [index]: name } })
  const nameFor = (index) => teamNames[index]?.trim() || `Team ${index + 1}`

  // Rearrange rolled teams by drag. `groups` is teams as lists of player ids in new order
  // (ids, not names, since two players may share a name). Persisted like any generated result.
  function arrangeTeams(groups) {
    const byId = new Map((result?.teams ?? []).flat().map((player) => [String(player.id), player]))
    patch({
      result: { teams: groups.map((ids) => ids.map((id) => byId.get(id)).filter(Boolean)) },
    })
  }

  return {
    names,
    rosterText,
    teamCount,
    liveConstraints,
    result,
    teamNames,
    draft,
    error,
    canGenerate: names.length >= 2 && names.length >= teamCount,
    setRosterText,
    setTeamCount,
    setDraft,
    clearEverything,
    stageAdd,
    stageRemove,
    generate,
    addConstraint,
    removeConstraint,
    renameTeam,
    nameFor,
    arrangeTeams,
  }
}
