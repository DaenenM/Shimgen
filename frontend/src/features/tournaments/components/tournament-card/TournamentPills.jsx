import { Trophy, Users } from '@/components/icons'
import { FORMAT_LABELS } from '@/features/bracket/utils/layout'

// Short format names for phone width, so a row stays one line at 375px
// ("Double elimination" + entrant count + state pill doesn't fit otherwise).
const FORMAT_LABELS_SHORT = {
  single: 'Single',
  double: 'Double',
  rr: 'Round robin',
  swiss: 'Swiss',
}

// Format is categorical, not good/bad, so it uses its own hue scale instead of
// success/warning/error. Same oklch values as the team colours.
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
    // light-dark() so the tone adjusts per theme instead of one fixed lightness.
    color: `light-dark(oklch(48% 0.16 ${hue}), oklch(74% 0.13 ${hue}))`,
    backgroundColor: `light-dark(oklch(48% 0.16 ${hue} / 0.12), oklch(74% 0.13 ${hue} / 0.16))`,
  }
}

// Shared shape for every pill in the meta row (format, entrants, winner/state).
const PILL =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 ' +
  'text-xs font-medium tracking-tight'

// State pill tone. Uses the semantic palette (success = live), not FORMAT_HUES,
// since state genuinely carries meaning; draft/complete stay neutral.
const STATE_PILL = {
  draft: 'bg-base-content/8 text-base-content/60',
  // Solid, not a wash — a live draft has to stand out against a list of finished nights.
  drafting: 'bg-success text-success-content',
  active: 'bg-success/15 text-success',
  complete: 'bg-base-content/8 text-base-content/60',
}

// Only 'drafting' differs from the raw state value.
const STATE_LABEL = {
  drafting: 'Live draft',
}

// Format, entrants, and winner/state pills under a tournament title. Used by
// TournamentCard.jsx. flex-nowrap keeps every row one line tall.
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
        >
          {(tournament.state === 'active' || isDrafting) && (
            // Pulsing dot makes an in-progress night findable at a glance.
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
