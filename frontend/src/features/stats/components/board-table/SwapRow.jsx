import { useState } from 'react'

import { User, Users } from '@/components/icons'

import { Popover } from './Popover'

/**
 * Swap a hand-typed row for a friend's real account.
 *
 * The case this exists for: you tallied "Brett" for a season before Brett had
 * an account, and now he has one. Re-typing loses the eight wins already on the
 * row, so the row is kept and its `player` link is pointed at the real person —
 * the tallies stay exactly where they are.
 *
 * Anyone already on this table is left out of the list. Two rows pointing at
 * one account would split that person's record in half, which is the opposite
 * of what the swap is for.
 */
export function SwapRow({ row, friends, taken, onSwap }) {
  const [open, setOpen] = useState(false)

  // Compared by account, not by name — the names differing is the whole reason
  // somebody is doing this.
  const alreadyHere = new Set(taken.map((other) => other.player_user_id ?? null).filter(Boolean))

  const options = friends.filter((friend) => friend.user?.id && !alreadyHere.has(friend.user.id))

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={`Swap ${row.display_name} for somebody with an account`}
      title="Swap for an account"
      icon={<Users className="h-3.5 w-3.5" />}
    >
      <span className="text-base-content/45 px-2 pt-0.5 pb-1 text-[0.6875rem] font-semibold tracking-wide uppercase">
        Swap for
      </span>

      {options.length === 0 ? (
        <span className="text-base-content/50 px-2 py-1.5 text-xs font-normal">
          Everyone is already on this table.
        </span>
      ) : (
        <span className="-mx-0.5 max-h-56 overflow-y-auto px-0.5">
          {options.map((friend) => (
            <button
              key={friend.id}
              type="button"
              onClick={() => {
                onSwap(friend.id, friend.display_name)
                setOpen(false)
              }}
              className="hover:bg-primary/10 hover:text-primary flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-normal transition-colors"
            >
              {friend.is_self ? (
                <User className="text-accent h-3.5 w-3.5 shrink-0" />
              ) : (
                <Users className="text-primary h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">{friend.display_name}</span>
            </button>
          ))}
        </span>
      )}
    </Popover>
  )
}
