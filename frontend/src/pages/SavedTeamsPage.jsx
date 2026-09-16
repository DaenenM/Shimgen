import { Check, Pencil, Plus, Trash2, User, Users, X } from '@/components/icons'
import { useMemo, useRef, useState } from 'react'

import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/SectionLoader'
import { useRoster } from '@/hooks/useRoster'
import { useSavedTeams } from '@/hooks/useSavedTeams'

/** Roughly 190KB of image once base64 has added its third. */
const LOGO_MAX_BYTES = 256 * 1024

/**
 * Squads kept between game nights.
 *
 * The roster answers "who plays"; this answers "who plays *together*". A crew
 * running the same four teams every Saturday picks the team in the new
 * tournament form and its members come with it, rather than rebuilding the
 * same sides each week.
 *
 * Members are roster entries rather than typed names, so the people on a team
 * carry their account links and their stats with them.
 */
export function SavedTeamsPage() {
  const { teams, isLoading, create, update, remove } = useSavedTeams()
  const { players, remember } = useRoster()

  // The team being edited, or 'new' while one is being created. One at a time:
  // a page of simultaneously open editors is a page where it is unclear which
  // set of changes a save applies to.
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)

  const busy = create.isPending || update.isPending || remove.isPending

  return (
    <PageShell className="glass-backdrop">
      <div className="rise-in rise-delay-1">
        <PageHeader
          title="Saved Teams"
          description="Squads you keep between game nights, ready to drop into a bracket."
        >
          <Button icon={Plus} onClick={() => setEditing('new')} disabled={editing === 'new'}>
            New team
          </Button>
        </PageHeader>
      </div>

      {editing === 'new' && (
        <div className="rise-in mb-4">
          <TeamEditor
            players={players}
            remember={remember}
            pending={create.isPending}
            error={create.error?.message}
            onCancel={() => setEditing(null)}
            onSave={(payload) =>
              create.mutate(payload, {
                onSuccess: () => setEditing(null),
              })
            }
          />
        </div>
      )}

      {isLoading ? (
        <SectionLoader label="Loading your teams…" />
      ) : teams.length === 0 && editing !== 'new' ? (
        <div className="border-base-content/12 text-base-content/50 rounded-[1.25rem] border border-dashed p-10 text-center">
          <Users className="mx-auto h-6 w-6 opacity-50" />
          <p className="mt-2 text-sm">No teams saved yet.</p>
          <p className="text-base-content/40 mt-1 text-xs">
            Build one from your roster and it will be one click away next time.
          </p>
        </div>
      ) : (
        <ul className="rise-in rise-delay-2 grid gap-3 sm:grid-cols-2">
          {teams.map((team) =>
            editing === team.id ? (
              <li key={team.id} className="sm:col-span-2">
                <TeamEditor
                  team={team}
                  players={players}
                  remember={remember}
                  pending={update.isPending}
                  error={update.error?.message}
                  onCancel={() => setEditing(null)}
                  onSave={(payload) =>
                    update.mutate(
                      { id: team.id, ...payload },
                      { onSuccess: () => setEditing(null) },
                    )
                  }
                />
              </li>
            ) : (
              <li key={team.id} className="glass-inset group flex items-center gap-3 p-3">
                <TeamCrest team={team} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{team.name}</p>
                  <p className="text-base-content/50 truncate text-xs">
                    {team.members.length === 0
                      ? 'Nobody on this team yet'
                      : team.members.map((m) => m.display_name).join(', ')}
                  </p>
                </div>

                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => setEditing(team.id)}
                    disabled={busy}
                    aria-label={`Edit ${team.name}`}
                    title="Edit"
                    className="text-base-content/35 hover:text-primary hover:bg-primary/10 grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-30 sm:opacity-60 sm:group-hover:opacity-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirming(team)}
                    disabled={busy}
                    aria-label={`Delete ${team.name}`}
                    title="Delete"
                    className="text-base-content/35 hover:text-error hover:bg-error/10 grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-30 sm:opacity-60 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={`Delete ${confirming?.name ?? 'this team'}?`}
        message="The team goes; the people on it stay in your roster."
        confirmLabel="Delete team"
        onConfirm={() => {
          remove.mutate(confirming.id)
          setConfirming(null)
        }}
        onCancel={() => setConfirming(null)}
      />
    </PageShell>
  )
}

/** A team's logo, or its initial when it has none. */
function TeamCrest({ team, size = 'h-10 w-10' }) {
  if (team.logo) {
    return (
      <img
        src={team.logo}
        alt=""
        className={`${size} shrink-0 rounded-lg object-cover`}
        aria-hidden="true"
      />
    )
  }

  return (
    <span
      className={`from-primary to-secondary text-primary-content ${size} grid shrink-0 place-items-center rounded-lg bg-gradient-to-br text-sm font-bold`}
      aria-hidden="true"
    >
      {(team.name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

/**
 * Create or correct a team.
 *
 * One component for both, because the fields and the rules are identical — a
 * separate "new" form would be the same code with a different heading, and the
 * two would drift.
 */
function TeamEditor({ team, players, remember, pending, error, onSave, onCancel }) {
  const [name, setName] = useState(team?.name ?? '')
  const [logo, setLogo] = useState(team?.logo ?? '')
  const [memberIds, setMemberIds] = useState(() => new Set(team?.members?.map((m) => m.id) ?? []))
  const [logoError, setLogoError] = useState(null)
  const [typed, setTyped] = useState('')
  // Names typed here but not yet resolved to a Player id. `remember` posts to
  // the roster and returns nothing, so the id only exists once the refreshed
  // list arrives — these are the names waiting for that.
  const [staged, setStaged] = useState([])
  const fileInput = useRef(null)

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
   * Add the typed name.
   *
   * Someone already on the roster is simply selected — `remember`
   * de-duplicates server-side, so re-posting an existing name is harmless, but
   * selecting directly avoids a needless round trip and works offline.
   */
  function addTyped() {
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

    setTyped('')
  }

  /**
   * Read the chosen file straight into a data URL.
   *
   * No upload endpoint and no storage configuration: the image travels with the
   * team as text. Checked against the same ceiling the server enforces, so an
   * oversized file is refused here rather than after a round trip.
   */
  function onPickLogo(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setLogoError(null)

    // The base64 encoding adds about a third, so the file itself has to be
    // comfortably under the stored ceiling.
    if (file.size > LOGO_MAX_BYTES * 0.74) {
      setLogoError('That image is too large — pick one under about 190KB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => setLogo(String(reader.result))
    reader.onerror = () => setLogoError('That file could not be read.')
    reader.readAsDataURL(file)
  }

  const canSave = name.trim().length > 0 && !pending

  return (
    <div className="glass-panel p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <TeamCrest team={{ name, logo }} size="h-12 w-12" />

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <input
              className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-10 w-full px-3 text-sm font-semibold transition-colors focus:outline-none"
              placeholder="Team name"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              aria-label="Team name"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-150"
              >
                {logo ? 'Change logo' : 'Add a logo'}
              </button>

              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo('')}
                  className="text-base-content/50 hover:text-error rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-150"
                >
                  Remove
                </button>
              )}

              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickLogo}
              />
            </div>
          </div>
        </div>

        {(logoError || error) && (
          <div
            role="alert"
            className="border-error/30 bg-error/12 text-error rounded-xl border px-3 py-2 text-sm"
          >
            {logoError ?? error}
          </div>
        )}

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">Members</span>
            <span className="text-base-content/40 text-xs">{selected.size} on the team</span>
          </div>
          <p className="text-base-content/50 mt-0.5 text-xs">
            Click a name to put them on the team, or type one in.
          </p>

          {/* Who is on the team right now.

              The list below only shows the roster, so a name typed in that is
              not saved there had no representation at all — it was on the team
              with nothing to click to take it back off. These pills are the one
              place every member appears, whichever kind they are. */}
          {memberPills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {memberPills.map((pill) => (
                <span
                  key={pill.key}
                  className="bg-primary/15 text-primary inline-flex h-7 items-center gap-1 rounded-full py-0 pr-1 pl-2.5 text-sm font-medium"
                >
                  <span className="max-w-[10rem] truncate">{pill.label}</span>
                  <button
                    type="button"
                    onClick={() => removeMember(pill)}
                    aria-label={`Remove ${pill.label} from the team`}
                    title={`Remove ${pill.label}`}
                    className="hover:bg-error/20 hover:text-error grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors duration-150"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Manual entry.

              A typed name becomes a roster entry first, then joins the team —
              members are Player rows precisely so they carry account links and
              stats, and a free-text member would be a string that merely looks
              like a person. `remember` de-duplicates server-side, so typing a
              name already on the roster simply selects it. */}
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              addTyped()
            }}
          >
            <input
              className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-9 min-w-0 flex-1 px-3 text-sm transition-colors focus:outline-none"
              placeholder="Add a name"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              aria-label="Add a player by name"
            />
            <button
              type="submit"
              disabled={!typed.trim()}
              className="bg-primary text-primary-content hover:bg-primary/90 grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30"
              aria-label="Add this name"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>

          {/* The same row structure as the saved roster rail: one name per
              line, a tick that becomes a cross on hover, and the glyphs that
              say which rows are you and which are friends. A wrapped field of
              pills made a long roster unreadable and hid that distinction
              entirely. */}
          {ordered.length === 0 ? (
            <p className="text-base-content/40 mt-3 py-3 text-center text-sm">
              Your roster is empty — type a name above to start one.
            </p>
          ) : (
            <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto pr-1">
              {ordered.map((player) => {
                const picked = selected.has(player.id)

                return (
                  <li key={player.id ?? player.display_name} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => toggle(player.id)}
                      aria-pressed={picked}
                      title={
                        picked ? `Remove ${player.display_name}` : `Add ${player.display_name}`
                      }
                      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left text-sm transition-colors duration-150 ${
                        picked
                          ? 'text-success hover:bg-error/10 hover:text-error'
                          : 'hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {picked ? (
                        // Tick at rest, cross on hover, both in one slot so the
                        // row does not reflow as they swap.
                        <span className="relative grid h-3.5 w-3.5 shrink-0 place-items-center">
                          <Check className="absolute h-3.5 w-3.5 transition-opacity duration-150 group-hover:opacity-0" />
                          <X className="absolute h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                        </span>
                      ) : (
                        <Plus className="h-3.5 w-3.5 shrink-0 opacity-40" />
                      )}
                      <span className="truncate font-medium">{player.display_name}</span>

                      {player.is_self ? (
                        <User
                          className="text-accent ml-auto h-3.5 w-3.5 shrink-0"
                          aria-label="You"
                          role="img"
                        />
                      ) : (
                        player.is_friend && (
                          <Users
                            className="text-primary ml-auto h-3.5 w-3.5 shrink-0"
                            aria-label="Friend"
                            role="img"
                          />
                        )
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            icon={Check}
            size="sm"
            disabled={!canSave}
            loading={pending}
            onClick={() =>
              onSave({
                name: name.trim(),
                logo,
                member_ids: [...selected],
              })
            }
          >
            {team ? 'Save changes' : 'Create team'}
          </Button>

          <Button icon={X} size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
