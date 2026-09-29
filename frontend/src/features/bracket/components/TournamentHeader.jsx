import { Play } from '@/components/icons'
import { CopyLinkButton } from '@/components/ui/CopyLinkButton'
import { paths } from '@/routes/paths'

import { FORMAT_LABELS } from '../utils/layout'
import { CohostManager } from './CohostManager'
import { EditableTitle } from './EditableTitle'
import { SaveIndicator } from './SaveIndicator'
import { StateBadge } from './StateBadge'
import { StatsBoardManager } from './StatsBoardManager'

/**
 * Title, format and state on the left; the host's controls on the right.
 *
 * `actions` is the object `useTournamentDetail` returns — the header decides
 * which of them the viewer is allowed to see.
 */
export function TournamentHeader({ tournament, user, isList, saveState, actions }) {
  const { start, nextRound, rename, linkBoard, addCohost, removeCohost } = actions

  /**
   * The account that actually built this bracket.
   *
   * Deliberately not `is_host`, which is also true for a co-host with a host
   * role and for the owner of the group it belongs to. Granting permission is
   * the creator's alone: someone handed the right to report results should not
   * be able to hand it onward, or the creator could end up with helpers they
   * never chose.
   */
  const isCreator = Boolean(user?.id && tournament.created_by?.id === user.id)
  const spectatorUrl = `${window.location.origin}${paths.spectate(
    tournament.public_slug,
    tournament.title,
  )}`

  return (
    // Only the header animates. The bracket below it re-renders on every
    // reported result, and a bracket that re-animated as scores were entered
    // would be intolerable on the page this app exists for.
    <div className="rise-in mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6 sm:gap-4">
      <div className="min-w-0">
        <EditableTitle
          title={tournament.title}
          canEdit={Boolean(tournament.is_host)}
          onSave={(title) => rename.mutate(title)}
          pending={rename.isPending}
        />
        <p className="text-base-content/60 mt-1 text-sm">
          {FORMAT_LABELS[tournament.format] ?? tournament.format} · {tournament.entrants.length}{' '}
          entrants
          <StateBadge state={tournament.state} />
        </p>
      </div>

      {/* One row on a phone, never wrapping. Every control here is either
          icon-only or truncates, so they fit across a 390px screen — and a
          cluster that cannot wrap cannot reflow, which is half of why this
          header used to shuffle. `min-w-0` lets the board pill absorb the
          squeeze rather than pushing Share off the end. */}
      <div className="relative flex min-w-0 flex-nowrap items-center gap-1.5 sm:flex-wrap sm:gap-2">
        {/* It answers "is the night recorded?", which is a question about this
            tournament, not about the page.

            Desktop only. It mounts from nothing on the first reported result,
            and in a wrapping flex row that reflowed every control after it — so
            the cluster jumped under the host's finger at the exact moment they
            were tapping winners. There is no room on a phone to reserve the
            space instead, and a header that moves while being used is worse
            than one that says less. */}
        <div className="hidden sm:block">
          <SaveIndicator state={saveState} />
        </div>

        {/* Host-only, and only with an account: a board belongs to one, and an
            anonymous quick-start bracket has none to attach to. */}
        {tournament.is_host && user && (
          <StatsBoardManager
            board={tournament.stats_board}
            onLink={(slug, tableId) => linkBoard.mutate({ slug, tableId })}
            pending={linkBoard.isPending}
            error={linkBoard.error?.message ?? null}
          />
        )}

        {isCreator && (
          <CohostManager
            cohosts={tournament.roles ?? []}
            creatorId={tournament.created_by?.id}
            onAdd={(userId) => addCohost.mutate(userId)}
            onRemove={(userId) => removeCohost.mutate(userId)}
            pending={addCohost.isPending || removeCohost.isPending}
          />
        )}

        {tournament.is_host && tournament.state === 'draft' && (
          <button
            className="group bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:px-4"
            onClick={() => start.mutate()}
            disabled={start.isPending}
          >
            <Play className="h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-hover:scale-110" />
            Start
          </button>
        )}

        {tournament.is_host && isList && tournament.state === 'active' && (
          <button
            className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-9 items-center rounded-xl px-4 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            onClick={() => nextRound.mutate()}
            disabled={nextRound.isPending}
          >
            Next round
          </button>
        )}

        <CopyLinkButton
          url={spectatorUrl}
          title="Copy a read-only link anyone can open without an account"
        />
      </div>
    </div>
  )
}
