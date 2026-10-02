import { useMemo, useState } from 'react'

// Tracks who's on a team being edited, from roster picks and typed names. Used by TeamEditor.jsx.
// A typed name not yet on the roster is posted via `remember` and joins the team once it gets an id.
export function useTeamMembers({ team, players, remember }) {
  const [memberIds, setMemberIds] = useState(() => new Set(team?.members?.map((m) => m.id) ?? []))
  // Typed names not yet resolved to a Player id -- waiting on the roster refetch.
  const [staged, setStaged] = useState([])

  // You first, then friends alphabetically, then everyone else in server order.
  // Same ordering as the saved-roster rail.
  const ordered = useMemo(() => {
    const me = players.filter((player) => player.is_self)
    const friends = players.filter((player) => player.is_friend && !player.is_self)
    const rest = players.filter((player) => !player.is_friend && !player.is_self)

    friends.sort((a, b) =>
      a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' }),
    )

    return [...me, ...friends, ...rest]
  }, [players])

  // Who's on the team: picked ids plus any staged name the roster has now resolved.
  // Computed here rather than reconciled in an effect, to avoid a cascading render.
  const selected = useMemo(() => {
    if (staged.length === 0) return memberIds

    const wanted = new Set(staged.map((name) => name.toLowerCase()))
    const next = new Set(memberIds)

    for (const player of players) {
      if (wanted.has(player.display_name.toLowerCase())) next.add(player.id)
    }

    return next
  }, [memberIds, staged, players])

  // Renderable pills for both kinds of member: roster members (by id) and staged typed names.
  const memberPills = useMemo(() => {
    const byId = new Map(players.map((player) => [player.id, player]))

    const saved = [...selected]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((player) => ({ key: `id:${player.id}`, id: player.id, label: player.display_name }))

    const known = new Set(saved.map((pill) => pill.label.toLowerCase()))

    // Only staged names not yet resolved, to avoid showing the same person twice.
    const pending = staged
      .filter((name) => !known.has(name.toLowerCase()))
      .map((name) => ({ key: `staged:${name.toLowerCase()}`, id: null, label: name }))

    return [...saved, ...pending]
  }, [selected, staged, players])

  // Remove a member, whichever kind (staged name or roster id).
  function removeMember(pill) {
    const gone = pill.label.toLowerCase()
    setStaged((current) => current.filter((name) => name.toLowerCase() !== gone))

    if (pill.id != null) {
      setMemberIds((current) => {
        const next = new Set(current)
        next.delete(pill.id)
        return next
      })
    }
  }

  function toggle(id) {
    // Must un-stage too: a just-typed name is on the team because it's staged, not
    // because its id is in memberIds -- deleting only the id would leave it re-added.
    const player = players.find((candidate) => candidate.id === id)
    if (player) {
      const gone = player.display_name.toLowerCase()
      setStaged((current) => current.filter((name) => name.toLowerCase() !== gone))
    }

    setMemberIds((current) => {
      const next = new Set(current)
      if (selected.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Add a typed name: select directly if already on the roster (avoids a round trip),
  // otherwise stage it and post via `remember`.
  function addName(typed) {
    const name = typed.trim()
    if (!name) return

    const existing = players.find(
      (player) => player.display_name.toLowerCase() === name.toLowerCase(),
    )

    if (existing) {
      setMemberIds((current) => new Set(current).add(existing.id))
    } else {
      remember([name])
      // Stored as typed (for pill display); comparisons lowercase both sides instead.
      setStaged((current) => [...current, name])
    }
  }

  return { ordered, selected, memberPills, toggle, removeMember, addName }
}
