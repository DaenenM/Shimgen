import { useMemo, useState } from 'react'

/**
 * Who is on a team being edited, from roster picks and typed names alike.
 *
 * Members are roster entries rather than typed names, so the people on a team
 * carry their account links and their stats with them. A typed name that is not
 * on the roster yet is posted there first (`remember`) and joins the team once
 * the refreshed roster has an id for it.
 */
export function useTeamMembers({ team, players, remember }) {
  const [memberIds, setMemberIds] = useState(() => new Set(team?.members?.map((m) => m.id) ?? []))
  // Names typed here but not yet resolved to a Player id. `remember` posts to
  // the roster and returns nothing, so the id only exists once the refreshed
  // list arrives — these are the names waiting for that.
  const [staged, setStaged] = useState([])

  /**
   * You first, then friends alphabetically, then everyone else as they came.
   *
   * The same ordering the saved-roster rail uses, and for the same reason: your
   * own name is the one most likely to be wanted and the one nobody should have
   * to hunt for, and the server's recency order is worth keeping for the rest.
   */
  const ordered = useMemo(() => {
    const me = players.filter((player) => player.is_self)
    const friends = players.filter((player) => player.is_friend && !player.is_self)
    const rest = players.filter((player) => !player.is_friend && !player.is_self)

    friends.sort((a, b) =>
      a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' }),
    )

    return [...me, ...friends, ...rest]
  }, [players])

  /**
   * Who is on the team: the ids picked plus any typed name the roster has
   * caught up with.
   *
   * Derived rather than reconciled in an effect. A typed name becomes a Player
   * first — members are foreign keys precisely so they carry account links and
   * stats — and its id only exists once the roster query refetches. Watching
   * for that in an effect and calling setState there is a cascading render;
   * computing it here is the same behaviour with none of that, and the staged
   * name simply stops mattering once its id is in the set.
   */
  const selected = useMemo(() => {
    if (staged.length === 0) return memberIds

    const wanted = new Set(staged.map((name) => name.toLowerCase()))
    const next = new Set(memberIds)

    for (const player of players) {
      if (wanted.has(player.display_name.toLowerCase())) next.add(player.id)
    }

    return next
  }, [memberIds, staged, players])

  /**
   * Everyone on the team, as something renderable.
   *
   * Two kinds of member, and the pills have to show both: a roster member has
   * an id and is found in `players`, while a name typed a moment ago exists
   * only as a staged string until the roster query catches up with it. Keying
   * on ids alone would leave a just-typed name invisible in the very row that
   * exists to let you take it back off.
   */
  const memberPills = useMemo(() => {
    const byId = new Map(players.map((player) => [player.id, player]))

    const saved = [...selected]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((player) => ({ key: `id:${player.id}`, id: player.id, label: player.display_name }))

    const known = new Set(saved.map((pill) => pill.label.toLowerCase()))

    // Only the staged names the roster has not produced a Player for yet —
    // once it has, the entry above is the same person and this would double it.
    const pending = staged
      .filter((name) => !known.has(name.toLowerCase()))
      .map((name) => ({ key: `staged:${name.toLowerCase()}`, id: null, label: name }))

    return [...saved, ...pending]
  }, [selected, staged, players])

  /** Take someone off the team, whichever kind of member they are. */
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
    // Un-staging matters as much as the id: a name typed a moment ago is on the
    // team *because* it is staged, not because its id is in `memberIds`, so
    // deleting the id alone would leave the derivation putting it straight
    // back.
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

  /**
   * Add a typed name.
   *
   * Someone already on the roster is simply selected — `remember`
   * de-duplicates server-side, so re-posting an existing name is harmless, but
   * selecting directly avoids a needless round trip and works offline.
   */
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
      // Stored as typed: this string is what the pill shows. Comparisons
      // against it lowercase both sides instead.
      setStaged((current) => [...current, name])
    }
  }

  return { ordered, selected, memberPills, toggle, removeMember, addName }
}
