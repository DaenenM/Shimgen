import { Trophy } from '@/components/icons'
import { ActionSheen } from '@/components/ui/ActionButton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useAuth } from '@/features/auth/hooks/useAuth'

import { ByeWarning } from './ByeWarning'
import { CaptainSettings } from './CaptainSettings'
import { FormatPicker } from './FormatPicker'
import { MatchOptions } from './MatchOptions'
import { StatsBoardField } from './StatsBoardField'

/** How they play: format, match options, stats board, and the create button. */
export function SettingsPanel({ form, className = '' }) {
  const { isAuthenticated } = useAuth()
  const { mode, create, blocker, warning } = form

  return (
    <div className={`glass-panel min-w-0 ${className}`}>
      <div className="flex flex-col gap-5 p-5">
        {/* Above Format because it decides what the entrants *are* — the format
            then decides how those entrants play each other. */}
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

        {/* Co-hosts are granted from the bracket page instead: choosing who may
            help is a decision made once the night is running, not while filling
            in a form. */}

        {isAuthenticated && (
          <StatsBoardField value={form.statsBoard} onChange={form.setStatsBoard} />
        )}

        {warning && <ByeWarning warning={warning} />}

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

        {blocker && <p className="text-base-content/50 -mt-3 text-center text-xs">{blocker}</p>}
      </div>
    </div>
  )
}
