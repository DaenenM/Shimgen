import { Archive, ArchiveRestore, RotateCcw, Star, Trash2, Trophy, Users } from '@/components/icons'
import { Link } from 'react-router-dom'

import { paths } from '@/routes/paths'

const FORMAT_LABELS = {
  single: 'Single elimination',
  double: 'Double elimination',
  rr: 'Round robin',
  swiss: 'Swiss',
  ffa: 'Free-for-all',
}

/**
 * The same formats, named for a phone.
 *
 * Length is what decided the row's height: at full width "Double elimination"
 * plus an entrant count plus a state pill cannot share one line on a 375px
 * screen, so those rows wrapped to two while "Round robin" stayed at one — the
 * list came out ragged, tall rows next to short ones.
 *
 * Shortening is better than wrapping or truncating. The row already says this
 * is a tournament, so "Double" is unambiguous, and it keeps every card the same
 * height whatever format it holds.
 */
const FORMAT_LABELS_SHORT = {
  single: 'Single',
  double: 'Double',
  rr: 'Round robin',
  swiss: 'Swiss',
  ffa: 'Free-for-all',
}

/**
 * A hue per format, as its own scale rather than borrowed semantic colours.
 *
 * Format is categorical — it says which kind of bracket this is, not whether
 * something is good or wrong — so it cannot use success/warning/error without
 * breaking the palette's one-hue-one-meaning rule. These are the same oklch
 * values the team colours use, which keeps every categorical colour in the app
 * on one scale. The old version reached for raw `teal-500` and `fuchsia-500`,
 * which sat outside the palette entirely and did not shift with the theme.
 */
const FORMAT_HUES = {
  single: 250,
  double: 195,
  rr: 150,
  swiss: 300,
  ffa: 55,
}

const formatTone = (format) => {
  const hue = FORMAT_HUES[format]
  if (hue === undefined) return undefined

  return {
    // `light-dark()` rather than one fixed lightness: a 72%-L hue is right on a
    // dark card and a pastel on a white one, which is the same reason the
    // palette rebuilds the light theme instead of inverting it. The custom
    // property is set per theme in index.css so this follows a theme switch.
    color: `light-dark(oklch(48% 0.16 ${hue}), oklch(74% 0.13 ${hue}))`,
    // A wash rather than a border. At this size a 1px outline plus a fill is
    // two competing edges on a 20px tall element, and on glass the outline is
    // what made these read as stickers rather than part of the card.
    backgroundColor: `light-dark(oklch(48% 0.16 ${hue} / 0.12), oklch(74% 0.13 ${hue} / 0.16))`,
  }
}

// One shared shape for every pill in the meta row — format, entrants, and
// winner all read as the same kind of thing, just in different tones.
//
// Borderless, 12px rather than 11px, and with real horizontal padding: the
// previous pills were small enough and tight enough to read as badges stamped
// on the row instead of labels belonging to it.
const PILL =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 ' +
  'text-xs font-medium tracking-tight'

const STATE_DOT = {
  draft: 'bg-base-content/30',
  active: 'bg-success',
  complete: 'bg-base-content/40',
}

/**
 * The state pill's tone.
 *
 * These use the semantic palette rather than the categorical `FORMAT_HUES`,
 * because state genuinely carries meaning: `success` is already "good / in
 * progress" and a live tournament is exactly that. Draft and complete stay
 * neutral — neither is a state worth colouring the row for, and giving all
 * three a colour would leave nothing standing out.
 */
const STATE_PILL = {
  draft: 'bg-base-content/8 text-base-content/60',
  active: 'bg-success/15 text-success',
  complete: 'bg-base-content/8 text-base-content/60',
}

export function TournamentCard({
  tournament,
  archived = false,
  onFavourite,
  onArchive,
  onRestore,
  onRunBack,
  onDelete,
  pending = false,
  // A glance rather than a workbench — the dashboard shows the same row but
  // keeps pinning, archiving and deleting on the tournaments page, which is one
  // tap away. Without this the row would render three controls wired to
  // handlers the caller never passed.
  readOnly = false,
}) {
  const name = tournament.title || 'Untitled tournament'
  const tone = formatTone(tournament.format)

  return (
    // `glass-inset` rather than `glass-panel`: these are dense list rows, and
    // a full panel's blur plus drop shadow, stacked twenty deep, reads as
    // twenty floating cards instead of one list.
    <li className="group glass-inset hover:border-base-content/25 hover:bg-base-content/5 relative min-w-0 transition-colors duration-200">
      {tournament.favourited_at && (
        <span
          className="bg-warning absolute inset-y-0 left-0 w-0.5 rounded-l-[0.875rem]"
          aria-hidden="true"
        />
      )}

      <div className="flex items-center gap-1.5 py-2.5 pr-1.5 pl-3 sm:gap-3 sm:pr-3 sm:pl-4">
        <Link to={paths.tournament(tournament.id, name)} className="min-w-0 flex-1 py-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                STATE_DOT[tournament.state] ?? STATE_DOT.draft
              }`}
              aria-hidden="true"
            />
            <h3 className="min-w-0 truncate text-[0.9375rem] leading-tight font-semibold">
              {name}
            </h3>
          </div>

          {/* Wrapping flex rather than a single grid row. The grid gave every
              pill its own fixed column, which on a phone left three pills and
              three buttons fighting over ~340px — and since a pill cannot
              shrink, the label broke instead: "Double / elimination" over two
              lines, in a row that was meant to be one.

              Wrapping moves the overflow to a second line, where there is
              room, and `whitespace-nowrap` on the pill keeps each label whole.
              The indent is dropped below `sm` for the same reason: aligning
              under the title costs 14px the pills need more.

              `flex-nowrap` rather than wrapping: every row is one line tall
              whatever it holds, which is what keeps the list even. The short
              format labels above are what make that fit. */}
          <div className="mt-1.5 flex flex-nowrap items-center gap-1.5 sm:pl-3.5">
            <span
              className={`${PILL} ${tone ? '' : 'bg-base-content/10 text-base-content/70'}`}
              style={tone}
            >
              <span className="sm:hidden">
                {FORMAT_LABELS_SHORT[tournament.format] ?? tournament.format}
              </span>
              <span className="hidden sm:inline">
                {FORMAT_LABELS[tournament.format] ?? tournament.format}
              </span>
            </span>

            {/* The icon is the unit at every width. It says "entrants" faster
                than the word does, and keeping one form across breakpoints
                means the row does not re-flow as the window is resized. The
                accessible name carries the word for anyone not seeing it. */}
            <span
              className={`${PILL} bg-base-content/8 text-base-content/70`}
              aria-label={`${tournament.entrant_count} ${
                tournament.entrant_count === 1 ? 'entrant' : 'entrants'
              }`}
            >
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {tournament.entrant_count}
            </span>

            {tournament.winner_label ? (
              <span className={`${PILL} bg-accent/15 text-accent min-w-0 !shrink`}>
                <Trophy className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tournament.winner_label}</span>
              </span>
            ) : (
              <span
                className={`${PILL} capitalize ${STATE_PILL[tournament.state] ?? STATE_PILL.draft}`}
              >
                {tournament.state === 'active' && (
                  // A live dot, so an in-progress night is findable by movement
                  // in a long list rather than only by reading each row.
                  <span className="bg-success h-1.5 w-1.5 animate-pulse rounded-full" />
                )}
                {tournament.state}
              </span>
            )}
          </div>
        </Link>

        {!readOnly && (
          <div className="flex shrink-0 items-center">
            {/* Run it back.

                An icon with a label on hover rather than a worded button: it
                sits in a row of three icon controls, and one button spelling
                itself out would make the row read as a toolbar with an odd
                stray in it. The title carries the words for a mouse, the
                aria-label for everything else.

                Not offered on an archived card — running one back puts a fresh
                draft in the list, which is the opposite of what archiving
                just said. */}
            {onRunBack && !archived && (
              <button
                type="button"
                onClick={() => onRunBack(tournament)}
                disabled={pending}
                aria-label={`Run ${name} back as a new tournament`}
                title="Run it back"
                className="text-base-content/35 hover:text-success hover:bg-success/10 group/again grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-30 sm:opacity-60 sm:group-hover:opacity-100"
              >
                <RotateCcw className="h-4 w-4 transition-transform duration-300 ease-out group-hover/again:-rotate-180" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onFavourite(tournament.id)}
              aria-label={tournament.favourited_at ? `Unpin ${name}` : `Pin ${name} to the top`}
              title={tournament.favourited_at ? 'Unpin' : 'Pin to the top'}
              className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
                tournament.favourited_at
                  ? 'text-warning hover:bg-warning/10'
                  : 'text-base-content/35 hover:text-warning hover:bg-warning/10 sm:opacity-60 sm:group-hover:opacity-100'
              }`}
            >
              <Star className="h-4 w-4" fill={tournament.favourited_at ? 'currentColor' : 'none'} />
            </button>

            <button
              type="button"
              onClick={() => (archived ? onRestore(tournament.id) : onArchive(tournament.id))}
              disabled={pending}
              aria-label={`${archived ? 'Restore' : 'Archive'} ${name}`}
              title={archived ? 'Put it back in the list' : 'Archive'}
              className="text-base-content/35 hover:text-primary hover:bg-primary/10 grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-30 sm:opacity-60 sm:group-hover:opacity-100"
            >
              {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => onDelete(tournament)}
              aria-label={`Delete ${name}`}
              title="Delete tournament"
              className="text-base-content/35 hover:text-error hover:bg-error/10 grid h-8 w-8 place-items-center rounded-lg transition-colors sm:opacity-60 sm:group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
