import { useState } from 'react'

import { Users } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCards } from '@/components/ui/Skeleton'
import { AddPlayerForm } from '@/features/roster/components/AddPlayerForm'
import { ArchivedPlayers } from '@/features/roster/components/ArchivedPlayers'
import { PasteNames } from '@/features/roster/components/PasteNames'
import { PlayerRow } from '@/features/roster/components/PlayerRow'
import { useRosterManager } from '@/features/roster/hooks/useRosterManager'

// Saved roster. Route: /roster
// Avoids re-typing names every game night (plan §3).
export function RosterPage() {
  const { isLoading, active, archived, add, archive, restore, remove } = useRosterManager()
  const [pasting, setPasting] = useState(false)

  return (
    <div className="glass-backdrop mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        className="rise-in rise-delay-1"
        title="My Roster"
        description="Names you've saved. They show up as one-click chips when you build an event."
      >
        <Button variant="secondary" size="sm" onClick={() => setPasting((p) => !p)}>
          Paste a list
        </Button>
      </PageHeader>

      <AddPlayerForm onAdd={add.mutate} />
      {pasting && <PasteNames onAdd={add.mutate} onClose={() => setPasting(false)} />}
      <ErrorAlert className="mb-4">{add.error?.message}</ErrorAlert>

      {isLoading ? (
        <SkeletonCards count={4} />
      ) : active.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No saved players"
          description="Add the people you play with and you'll never type their names twice."
        />
      ) : (
        <ul className="grid gap-2">
          {active.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              onArchive={() => archive.mutate(player.id)}
              onRemove={() => remove.mutate(player.id)}
            />
          ))}
        </ul>
      )}

      <ArchivedPlayers players={archived} onRestore={restore.mutate} onRemove={remove.mutate} />
    </div>
  )
}
