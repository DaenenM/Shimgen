import { Trophy, Users } from '@/components/icons'
import { FORMAT_LABELS } from '@/features/bracket/utils/layout'

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
  // The one state that is asking something of the reader: a lobby is open and
  // somebody is waiting on them to pick. Solid rather than the 15% wash `active`
  // uses, because a live draft has to win against a list of finished nights.
  drafting: 'bg-success text-success-content',
  active: 'bg-success/15 text-success',
  complete: 'bg-base-content/8 text-base-content/60',
}

/** What the state pill says. Only `drafting` differs from the raw value. */
const STATE_LABEL = {
  drafting: 'Live draft',
}

/**
 * Format, entrants, and the winner or state, under a tournament's title.
 *
 * `flex-nowrap` rather than wrapping: every row is one line tall whatever it
 * holds, which is what keeps the list even. The short format labels above are
 * what make that fit. The indent is dropped below `sm`: aligning under the
 * title costs 14px the pills need more.
 */
export function TournamentPills({ tournament }) {
  const tone = formatTone(tournament.format)
  const isDrafting = tournament.state === 'drafting'

  return (
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

      {/* The icon is the unit at every width. It says "entrants" faster than
          the word does, and keeping one form across breakpoints means the row
          does not re-flow as the window is resized. The accessible name carries
          the word for anyone not seeing it. */}
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
          title={isDrafting ? 'A captain draft is in progress' : undefined}
          // "drafting" beside "draft" is two states a glance cannot tell apart,
          // and they mean opposite things — one is waiting to start, the other
          // is happening right now.
        >
          {(tournament.state === 'active' || isDrafting) && (
            // A live dot, so an in-progress night is findable by movement in a
            // long list rather than only by reading each row. A draft earns it
            // most: somebody is waiting on a pick.
            <span
              className={`h-1.5 w-1.5 animate-pulse rounded-full ${
                isDrafting ? 'bg-success-content' : 'bg-success'
              }`}
            />
          )}
          {STATE_LABEL[tournament.state] ?? tournament.state}
        </span>
      )}
    </div>
  )
}
