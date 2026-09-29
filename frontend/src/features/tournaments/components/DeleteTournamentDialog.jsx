import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

/**
 * Confirms deleting a tournament. Deleting takes every match and result with
 * it, which is worth a real pause.
 */
export function DeleteTournamentDialog({ tournament, pending, onConfirm, onCancel }) {
  return (
    <ConfirmDialog
      open={Boolean(tournament)}
      title={`Delete ${tournament?.title || 'this tournament'}?`}
      // The board consequence is named only when there is a board, so the
      // warning stays true and does not become noise hosts click past.
      message={
        tournament?.feeds_stats_board
          ? 'Every match and result in it goes too — and the wins, losses and trophies it added to its stats board are taken back off. This cannot be undone. To keep the stats, archive it instead.'
          : 'Every match and result in it goes too. This cannot be undone. To keep it out of your list without losing the results, archive it instead.'
      }
      confirmLabel="Delete tournament"
      pending={pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
