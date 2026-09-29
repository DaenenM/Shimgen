import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

// Confirms deleting a tournament (takes every match/result with it). Used by TournamentsPage.jsx.
export function DeleteTournamentDialog({ tournament, pending, onConfirm, onCancel }) {
  return (
    <ConfirmDialog
      open={Boolean(tournament)}
      title={`Delete ${tournament?.title || 'this tournament'}?`}
      // Board consequence only mentioned when there's a linked board.
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
