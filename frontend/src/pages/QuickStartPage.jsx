import { Info, Trophy } from '@/components/icons'

import { PageShell } from '@/components/layout/PageShell'
import { ActionSheen } from '@/components/ui/ActionButton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { PageHeader } from '@/components/ui/PageHeader'
import { RosterPicker } from '@/components/ui/RosterPicker'
import { SavedRoster } from '@/components/ui/SavedRoster'
import { SavedTeamPicker } from '@/components/ui/SavedTeamPicker'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { CaptainSettings } from '@/features/new-tournament/CaptainSettings'
import { FormatPicker } from '@/features/new-tournament/FormatPicker'
import { MatchOptions } from '@/features/new-tournament/MatchOptions'
import { StatsBoardField } from '@/features/new-tournament/StatsBoardField'
import { TeamBuilder } from '@/features/new-tournament/TeamBuilder'
import { useNewTournamentForm } from '@/features/new-tournament/useNewTournamentForm'
import { teamTone } from '@/features/teams/tone'
import { useAuth } from '@/hooks/useAuth'

// The third entry is the phone label, where three full ones do not fit.
const MODES = [
  ['solo', 'Solo players', 'Solo'],
  ['teams', 'Teams'],
  // Captains is still a list of solo players — the teams are what the draft
  // produces, not what the host types. It shares the solo entry box for
  // exactly that reason.
  ['captains', 'Team captains', 'Captains'],
]

/**
 * Build a tournament, with or without an account.
 *
 * Nothing here requires a login (plan §4, NEW 6). An anonymous bracket comes
 * back with a claim token, so it can be attached to an account afterwards.
 */
export function QuickStartPage() {
  const { isAuthenticated } = useAuth()
  const form = useNewTournamentForm()
  const { mode, create, blocker, warning } = form

  return (
    <PageShell width="wide" className="glass-backdrop">
      {/* Header and grid share one container sized to exactly what the columns
          occupy — 13 + 33 + 20rem of track plus two 1.5rem gaps — so the title
          starts on the same line as the roster rail and the block is centred,
          the same arrangement the Team Generator uses. */}
      <div className="mx-auto w-full max-w-[69rem]">
        <PageHeader
          className="rise-in rise-delay-1"
          title="New tournament"
          description="Add names, pick a format, and you have a bracket. No account needed."
        />

        {/* Three columns rather than one long page. With a dozen teams the format
          choices and the create button were several screens below the fold, so
          the list scrolls inside its own column and the settings stay in view.
          The roster sits beside the form rather than in it, so the names people
          are about to click are not below the box they are typing in. */}
        {/* The middle column is capped at 33rem: wide enough for two team
          cards abreast, without stretching the form across the whole screen. */}
        <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,33rem)_20rem]">
          {/* `self-start` sits on the wrapper because the wrapper is the grid
            item: without it the roster rail stretches to the row's height. */}
          <div className="rise-in rise-delay-2 flex min-w-0 flex-col gap-4 self-start lg:sticky lg:top-20">
            <SavedRoster
              selected={form.placed}
              onAdd={form.addFromRoster}
              onRemove={form.removeFromRoster}
              target={
                mode === 'teams' && form.teams.length > 0
                  ? {
                      label:
                        form.teams[form.activeTeam]?.label.trim() || `Team ${form.activeTeam + 1}`,
                      color: teamTone(form.activeTeam).edge,
                    }
                  : null
              }
            />

            {/* Teams mode only. A saved team has nowhere to go in solo mode —
              the players box takes names, not sides. */}
            {mode === 'teams' && (
              <SavedTeamPicker
                onPick={form.addSavedTeam}
                placed={form.teams.map((team) => team.label)}
                glass
              />
            )}
          </div>

          {/* ── Who is playing ─────────────────────────────────────────────── */}
          <div className="glass-panel rise-in rise-delay-3 min-w-0">
            <div className="flex flex-col gap-5 p-5">
              <label className="flex w-full flex-col">
                <span className="label-text mb-1">
                  Title <span className="text-base-content/40">(optional)</span>
                </span>
                <input
                  type="text"
                  className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-10 w-full px-3 text-sm transition-colors focus:outline-none"
                  placeholder="Friday Night Showdown"
                  value={form.title}
                  onChange={(e) => form.setTitle(e.target.value)}
                />
              </label>

              <div>
                <SegmentedControl
                  label="Who is entering"
                  options={MODES}
                  value={mode}
                  onChange={form.setMode}
                  // Full width: it heads the panel, and an inline switcher left
                  // a ragged gap at its right end under the full-width title.
                  block
                  className="mb-4"
                />

                {/* The teams grow the page rather than scrolling inside a capped
                  box: squeezed into one on a phone, the cards stacked on top of
                  each other, and an expand toggle was one more thing to find. */}
                <div
                  className={`flex flex-col ${mode === 'teams' ? '' : 'max-h-[calc(100vh-21rem)]'}`}
                >
                  {mode === 'teams' ? (
                    <TeamBuilder
                      teams={form.teams}
                      onChange={form.setTeams}
                      activeTeam={form.activeTeam}
                      onFocusTeam={form.setActiveTeam}
                    />
                  ) : (
                    <RosterPicker
                      value={form.rosterText}
                      onChange={form.setRosterText}
                      count={form.names.length}
                      glass
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── How they play ──────────────────────────────────────────────── */}
          <div className="glass-panel rise-in rise-delay-4 min-w-0 lg:sticky lg:top-20">
            <div className="flex flex-col gap-5 p-5">
              {/* Above Format because it decides what the entrants *are* — the
                format then decides how those entrants play each other. */}
              {mode === 'captains' && (
                <CaptainSettings
                  captains={form.captains}
                  names={form.names}
                  onChange={form.setCaptains}
                />
              )}

              <FormatPicker value={form.format} onChange={form.setFormat} />

              <MatchOptions
                format={form.format}
                bestOf={form.bestOf}
                onBestOfChange={form.setBestOf}
                thirdPlace={form.thirdPlace}
                onThirdPlaceChange={form.setThirdPlace}
                bracketReset={form.bracketReset}
                onBracketResetChange={form.setBracketReset}
              />

              {/* Co-hosts are granted from the bracket page instead: choosing who
                may help is a decision made once the night is running, not while
                filling in a form. */}

              {isAuthenticated && (
                <StatsBoardField value={form.statsBoard} onChange={form.setStatsBoard} />
              )}

              {/* Said before the host commits, rather than after. A red edge
                rather than the quiet glass box it used to be: sitting among the
                settings it read as one more hint and was skipped, and a bracket
                full of byes is the thing hosts then think is broken. The text
                stays the body colour — the border draws the eye, the words
                still have to be comfortable to read. */}
              {warning && (
                <div
                  role="note"
                  className="border-error/60 bg-error/8 flex items-start gap-2.5 rounded-xl border p-3 text-sm"
                >
                  <Info className="text-error mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p>{warning.message}</p>
                    <p className="text-base-content/60 mt-0.5 text-xs">{warning.hint}</p>
                  </div>
                </div>
              )}

              <ErrorAlert>{create.error?.message}</ErrorAlert>

              <button
                className="group bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
                disabled={Boolean(blocker) || create.isPending}
                onClick={() => create.mutate()}
              >
                <ActionSheen />
                {create.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <Trophy className="h-4.5 w-4.5 transition-transform duration-200 ease-out group-hover:-rotate-12" />
                )}
                Create tournament
              </button>

              {blocker && (
                <p className="text-base-content/50 -mt-3 text-center text-xs">{blocker}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
