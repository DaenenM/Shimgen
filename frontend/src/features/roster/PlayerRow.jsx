import { Archive, ArchiveRestore, Trash2, User, Users } from '@/components/icons'

/** One saved player, active or archived, with the actions that fit its state. */
export function PlayerRow({ player, archived, onArchive, onRestore, onRemove }) {
  // No words for either kind of linked row: the icon beside the name says it,
  // and spelling the same fact out underneath was saying it twice. Being
  // archived is the one state the row cannot show any other way.
  const status = archived ? 'Archived' : null

  const played = player.last_used_at
    ? `last played ${new Date(player.last_used_at).toLocaleDateString()}`
    : null

  // Joined rather than concatenated with a hard separator, so whichever half is
  // missing does not leave a dangling dot.
  const meta = [status, played].filter(Boolean).join(' · ')

  return (
    // An archived row is dimmed and dashed, so the two lists cannot be confused
    // when both are on screen at once.
    <li
      className={
        archived
          ? 'border-base-content/12 rounded-xl border border-dashed opacity-70'
          : 'glass-inset'
      }
    >
      <div className="flex flex-row items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p
            className={`flex items-center gap-2 truncate text-sm font-medium ${archived ? 'text-base-content/60' : ''}`}
          >
            <span className="truncate">{player.display_name}</span>

            {/* The meta line below already says "Follows their name", so here
                the glyph is reinforcement rather than the only signal. */}
            {player.is_friend ? (
              <Users className="text-primary h-3.5 w-3.5 shrink-0" aria-label="Friend" role="img" />
            ) : (
              // An account attached without being a friend — somebody who
              // claimed a bracket, say. Amber rather than the friend blue:
              // `--color-accent` is the hue the backdrop mesh already warms the
              // page with, so a second kind of link reads as related to the
              // first without being mistaken for it.
              player.linked && (
                <User
                  className="text-accent h-3.5 w-3.5 shrink-0"
                  aria-label="Linked account"
                  role="img"
                />
              )
            )}
          </p>
          {/* A plain roster entry says nothing here. "Name only" described the
              absence of a link, which is the ordinary case — most of a roster
              is names somebody typed — so it was a label on nothing.

              Computed above the markup rather than nested further: with the
              fallback gone the ternary would have ended in an empty string,
              and the separator below would then have rendered a stray
              " · last played" with nothing in front of it. */}
          {meta && <p className="text-base-content/50 text-xs">{meta}</p>}
        </div>

        <div className="flex gap-1">
          {archived ? (
            <button
              className="bg-primary text-primary-content hover:bg-primary/90 inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-150"
              onClick={onRestore}
              title="Put them back on the roster"
              aria-label={`Restore ${player.display_name}`}
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Restore
            </button>
          ) : (
            <button
              className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium transition-colors duration-150"
              onClick={onArchive}
              title="Archive: hides them without losing their history"
              aria-label={`Archive ${player.display_name}`}
            >
              <Archive className="h-4 w-4" />
            </button>
          )}

          {/* Deleting is offered only for a plain typed name. A row backed by
              an account — a friend, or you — takes a real person's rating
              history with it, so archiving is the whole of what is on offer and
              the delete control is not rendered at all rather than rendered
              and refused. The server enforces the same rule. */}
          {!player.is_friend && !player.is_self && (
            <button
              className="text-error hover:bg-error/10 inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium transition-colors duration-150"
              onClick={onRemove}
              title="Delete permanently"
              aria-label={`Delete ${player.display_name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
