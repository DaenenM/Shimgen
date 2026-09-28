import { useCallback, useMemo, useState } from 'react'

import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useRoster } from '@/hooks/useRoster'

import { generateTeams } from './generate'

/** Namespaced like the app's other stored values (`shim.roster`, `shim.access`). */
const STORAGE_KEY = 'shim.team-generator'

/**
 * Module-level, not a fresh object per render.
 *
 * `useLocalStorage` is built on `useSyncExternalStore`, which compares
 * snapshots by identity — a new default each render would report a changed
 * store on every pass and loop. The same reason `useLocalRoster` keeps its
 * `EMPTY` at module scope.
 */
const EMPTY_SETUP = {
  rosterText: '',
  teamCount: 2,
  constraints: [],
  result: null,
  teamNames: {},
}

const EMPTY_DRAFT = { kind: 'apart', a: '', b: '' }

// Shared everywhere a name list needs to come from raw text: the textarea
// itself, and the staging helpers that edit it from outside.
function parseNames(text) {
  return text
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter(Boolean)
}

/**
 * The team generator's state and actions.
 *
 * One source of truth for who is playing — the textarea's raw text — and
 * `names` is just that text parsed. Picking a saved name stages it into the
 * text instead of a separate list, so there's exactly one place a host looks
 * to see who's in.
 */
export function useTeamGenerator() {
  const { touchLocal } = useRoster()

  // Everything a host has actually entered survives a reload. Typing ten names,
  // setting up rules and rolling teams is several minutes of work, and losing
  // it to an accidental refresh — or to following a link and coming back — is
  // the kind of thing that makes people distrust the page and keep a paper
  // list. Held in one record rather than five keys so a reload restores a
  // coherent setup: a stored result whose roster had already been cleared would
  // show teams built from names no longer on the page.
  const [saved, setSaved] = useLocalStorage(STORAGE_KEY, EMPTY_SETUP)
  const { rosterText, teamCount, constraints, result, teamNames } = saved

  const patch = useCallback(
    (changes) => setSaved((current) => ({ ...current, ...changes })),
    [setSaved],
  )

  // Deliberately not persisted. `draft` is a half-built rule and `error` is a
  // complaint about the last click — restoring either would greet a returning
  // host with a stale grievance rather than with their teams.
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

  /**
   * Back to an empty page — what "Clear all" means here.
   *
   * Everything on this page hangs off the player list: the teams were generated
   * from it, the rules name people in it, and the team count is bounded by how
   * many there are. Clearing only the names left teams on screen built from
   * players who were no longer listed, and rules pointing at nobody.
   *
   * Written as one assignment to `EMPTY_SETUP` rather than five patches, so the
   * stored record can never come back half-cleared — a reload after a partial
   * reset would restore exactly the stale teams this is meant to remove. The
   * unsaved rule and error go too: a half-typed rule surviving a clear is the
   * same bug at smaller scale.
   */
  const clearEverything = useCallback(() => {
    setSaved(EMPTY_SETUP)
    setDraft(EMPTY_DRAFT)
    setError(null)
  }, [setSaved])

  // Adds a saved name to the text field rather than to a list — appended as
  // its own line, so it reads the same as if the host had typed it.
  function stageAdd(name) {
    setRosterText((current) => [...parseNames(current), name].join('\n'))
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
  }
}
