import { useState } from 'react'

import { Check, X } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { TeamCrest } from '@/components/ui/TeamCrest'

import { useTeamMembers } from '../hooks/useTeamMembers'
import { AddNameForm } from './AddNameForm'
import { LogoPicker } from './LogoPicker'
import { MemberPills } from './MemberPills'
import { RosterChecklist } from './RosterChecklist'

/**
 * Create or correct a team.
 *
 * One component for both, because the fields and the rules are identical — a
 * separate "new" form would be the same code with a different heading, and the
 * two would drift.
 */
export function TeamEditor({ team, players, remember, pending, error, onSave, onCancel }) {
  const [name, setName] = useState(team?.name ?? '')
  const [logo, setLogo] = useState(team?.logo ?? '')
  const [logoError, setLogoError] = useState(null)
  const { ordered, selected, memberPills, toggle, removeMember, addName } = useTeamMembers({
    team,
    players,
    remember,
  })

  const canSave = name.trim().length > 0 && !pending

  return (
    <div className="glass-panel p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <TeamCrest team={{ name, logo }} size="lg" />

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <input
              className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-10 w-full px-3 text-sm font-semibold transition-colors focus:outline-none"
              placeholder="Team name"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              aria-label="Team name"
            />
            <LogoPicker logo={logo} onChange={setLogo} onError={setLogoError} />
          </div>
        </div>

        <ErrorAlert>{logoError ?? error}</ErrorAlert>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">Members</span>
            <span className="text-base-content/40 text-xs">{selected.size} on the team</span>
          </div>
          <p className="text-base-content/50 mt-0.5 text-xs">
            Click a name to put them on the team, or type one in.
          </p>

          <MemberPills pills={memberPills} onRemove={removeMember} />
          <AddNameForm onAdd={addName} />
          <RosterChecklist players={ordered} selected={selected} onToggle={toggle} />
        </div>

        <div className="flex gap-2">
          <Button
            icon={Check}
            size="sm"
            disabled={!canSave}
            loading={pending}
            onClick={() => onSave({ name: name.trim(), logo, member_ids: [...selected] })}
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
