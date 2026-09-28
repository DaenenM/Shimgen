import { Plus } from '@/components/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ChoiceGroup, Field, TextInput } from '@/components/ui/Field'
import { paths } from '@/routes/paths'

/** Name a board, choose what it counts, and go straight to it. */
export function NewBoardForm({ create, onClose }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  // Decides the board's first table: a hand-counted tally, or the four columns
  // a linked bracket fills in by itself.
  const [tracks, setTracks] = useState(false)

  function submit() {
    if (!name.trim()) return
    create.mutate(
      { name: name.trim(), tracks_tournaments: tracks },
      { onSuccess: (board) => navigate(paths.board(board.slug, board.name)) },
    )
  }

  return (
    <Card padding="lg" className="mb-6 space-y-4">
      <Field label="Board name">
        <TextInput
          placeholder="Game Night Wins"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onClose()
          }}
        />
      </Field>

      <div className="space-y-2">
        <span className="text-sm font-medium">What is it counting?</span>
        <ChoiceGroup
          name="board-kind"
          value={tracks}
          onChange={setTracks}
          options={[
            {
              value: false,
              label: 'Counted by hand',
              hint: 'You add each win yourself. The game night that never became a bracket.',
            },
            {
              value: true,
              label: 'From tournaments',
              hint: 'Games played, wins, losses and tournament wins, kept up to date by linked brackets.',
            },
          ]}
        />
      </div>

      <ErrorAlert>{create.error?.message}</ErrorAlert>

      <div className="flex flex-wrap gap-2">
        <Button icon={Plus} disabled={!name.trim()} loading={create.isPending} onClick={submit}>
          Create board
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Card>
  )
}
