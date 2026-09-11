import { ArrowDown, ArrowUp, Pencil, Trash2, User, Users, X, Zap } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useDragScroll } from '@/hooks/useDragScroll'
import { useIsSmallScreen } from '@/hooks/useMediaQuery'

import { TallyCell } from './TallyCell'

// The name column sorts like the others but has no StatsColumn behind it, so it
// needs a key that cannot collide with a real column id.
const NAME_KEY = 'name'

/**
 * What each kind of column is worth, as colour.
 *
 * Every number on this board used to be body text, so "games played", "won",
 * "lost" and "tournaments won" were four columns of identical white digits and
 * telling a good line from a bad one meant reading the headers each time.
 *
 * Only the columns that carry a verdict get a hue. Games played is a volume,
 * not a result, and a hand-counted column means whatever its crew decided it
 * means — colouring either would be asserting something the data does not say.
 */
const ROLE_TONE = {
  tournaments_won: 'text-accent',
  won: 'text-success',
  lost: 'text-error/85',
}

/**
 * One section of a board — "Solo", "Teams".
 *
 * Sorted by the leading column to begin with, so the board reads as a standing:
 * the person in front is at the top, which is the whole reason anyone looks at
 * it. Any header re-sorts by that column, and clicking the same one again
 * flips the direction.
 */
export function BoardTable({
  table,
  canEdit,
  editing,
  friends = [],
  onAward,
  onRemoveRow,
  onEditColumn,
  onRemoveColumn,
  onSwapRow,
  onRenameRow,
  onUnlinkRow,
  busyKey,
}) {
  const { columns, rows } = table

  // Phones always count in numbers: seven tridents in a 90px column wrap into
  // an unreadable smear, which is exactly what a real Pummel Party tally looks
  // like on a phone.
  const isSmall = useIsSmallScreen()

  // Drag the table sideways by its background. The tally cells and sort headers
  // are buttons, so the hook leaves them alone — a mis-aimed tap on `+1` is
  // still a tap on `+1`, however much the hand moves afterwards.
  const scroller = useDragScroll()

  /**
   * How a cell draws itself.
   *
   * A single tally column is the "Brett: 🔱🔱🔱🔱" board — the emoji row is the
   * whole point, and it reads at a glance. Two or more columns is a table, and
   * two rows of glyphs side by side stop being readable: at that width the eye
   * cannot compare six tridents against four. So a table with more than one
   * column counts in numbers, whatever each column was set to — and so does any
   * column on a screen too narrow to lay marks out.
   */
  const displayFor = (column) =>
    column.display === 'number' || columns.length > 1 || isSmall ? 'number' : 'emoji'

  // `null` means "the leading column, descending" — the default standing. Held
  // per table, so sorting one section does not reorder the others.
  const [sort, setSort] = useState(null)

  /**
   * What the board leads with before anyone clicks a header.
   *
   * Trophies first when the table has them. A tournament board's columns come
   * out in role order — played, won, lost, tournaments won — so the leftmost
   * column is "games played", and leading with it ranks whoever turned up most
   * rather than whoever won. Tournaments won is the standing everyone actually
   * came to see.
   *
   * Falls back to the first column for a hand-counted board, which has no
   * trophy column and whose first column is the thing it was made to count.
   */
  const trophyColumn = columns.find((column) => column.role === 'tournaments_won')

  // The key is an id, not a column object: the name column is sortable too and
  // has no column row behind it, so looking one up would come back undefined
  // and silently sort everything by the same value.
  const sortKey = sort ? sort.key : (trophyColumn?.id ?? columns[0]?.id ?? NAME_KEY)
  const descending = sort ? sort.descending : true

  function toggle(key) {
    setSort((current) =>
      // Same column: flip. A different one starts descending for tallies —
      // "most wins first" is what a click on a number column means — and
      // ascending for names, where A-Z is the natural first reading.
      current && current.key === key
        ? { key, descending: !current.descending }
        : { key, descending: key !== NAME_KEY },
    )
  }

  const value = (row) =>
    sortKey === NAME_KEY ? row.display_name.toLowerCase() : (row.counts?.[sortKey] ?? 0)

  const sorted = [...rows].sort((a, b) => {
    const left = value(a)
    const right = value(b)

    // Ties keep their existing order rather than shuffling on every render.
    if (left === right) return rows.indexOf(a) - rows.indexOf(b)

    const ahead = left > right ? 1 : -1
    return descending ? -ahead : ahead
  })

  /** The arrow shown on whichever header is currently sorting. */
  /**
   * The sort arrow, in a slot that is always there.
   *
   * Returning `null` for an unsorted column meant the arrow appeared and
   * disappeared from the flex row, so every click widened one header and shoved
   * the rest of the table sideways — the whole grid twitched on each sort. The
   * slot is now reserved whatever the state, and only its contents change.
   */
  const marker = (key) => (
    <span className="grid h-3 w-3 shrink-0 place-items-center" aria-hidden="true">
      {sortKey === key ? (
        descending ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUp className="h-3 w-3" />
        )
      ) : null}
    </span>
  )

  if (columns.length === 0) {
    return (
      <p className="text-base-content/50 py-6 text-center text-sm">
        This table has no columns yet.
      </p>
    )
  }

  // A narrow table has no business scrolling sideways.
  //
  // `min-w-[28rem]` is what four automatic columns need to stay readable, but
  // applied to a phone it forced 448px into a 343px viewport: the table
  // scrolled sideways, the name column sat pinned at 160px, and the single
  // value column was handed the ~290px left over — a number 24px wide adrift in
  // the middle of it.
  //
  // Screen size alone decides it. Folding the column count in as well was a
  // mistake: a one-column board on a desktop then took the narrow path, which
  // squeezes the value cell to `w-px` — and a column of eight trophies, given
  // no width, wrapped to one glyph per line. The emoji tally is exactly what
  // the roomy layout exists for, so any wide screen gets it whatever the board
  // holds. `displayFor` already switches to numbers on a phone, so the marks
  // that needed the width are not being drawn on the narrow path anyway.
  const wide = !isSmall

  return (
    <div ref={scroller} className={wide ? 'overflow-x-auto' : ''}>
      <table className={`w-full border-collapse ${wide ? 'min-w-[28rem]' : ''}`}>
        <thead>
          <tr className="border-base-content/10 border-b">
            <th
              // Fluid rather than fixed on a narrow board, so the name takes
              // the room it needs and the tally keeps the rest.
              className={`px-3 py-2 text-left ${wide ? 'w-40' : 'w-auto'}`}
              aria-sort={sortKey === NAME_KEY ? (descending ? 'descending' : 'ascending') : 'none'}
            >
              <button
                type="button"
                onClick={() => toggle(NAME_KEY)}
                className="hover:text-base-content flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase transition-colors"
              >
                <span className="text-base-content/50">Player</span>
                {marker(NAME_KEY)}
              </button>
            </th>

            {columns.map((column) => (
              <th
                key={column.id}
                className={`relative py-2 text-left ${wide ? 'px-3' : 'w-px px-2 whitespace-nowrap'}`}
                aria-sort={
                  sortKey === column.id ? (descending ? 'descending' : 'ascending') : 'none'
                }
              >
                <button
                  type="button"
                  onClick={() => toggle(column.id)}
                  title={`Sort by ${column.name}`}
                  // Centred over centred values, so a numeric column reads as
                  // one aligned block rather than a header adrift of its data.
                  className={`hover:text-base-content flex w-full items-center gap-1.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
                    displayFor(column) === 'number' ? 'justify-center' : ''
                  }`}
                >
                  <span className="text-base" aria-hidden="true">
                    {column.emoji}
                  </span>
                  <span className={ROLE_TONE[column.role] ?? 'text-base-content/70'}>
                    {column.name}
                  </span>
                  {column.role !== 'manual' && (
                    <span
                      title="Kept up to date by linked tournaments"
                      className="text-primary/70 normal-case"
                      aria-label="Updated automatically"
                    >
                      <Zap className="h-3 w-3" />
                    </span>
                  )}
                  {marker(column.id)}
                </button>

                {/* Layered under the sort button rather than replacing it: a
                    header still sorts while the board is being edited, and a
                    column's name and mark are changed from where they are
                    read. */}
                {editing && (
                  <ColumnEditor
                    column={column}
                    onSave={(payload) => onEditColumn?.(column.id, payload)}
                    onRemove={() => onRemoveColumn?.(column.id)}
                  />
                )}
              </th>
            ))}

            {canEdit && <th className="w-10" />}
          </tr>
        </thead>

        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (canEdit ? 2 : 1)}
                className="text-base-content/50 px-3 py-8 text-center text-sm"
              >
                No players yet.
              </td>
            </tr>
          )}

          {sorted.map((row, index) => {
            /* The board exists to say who is in front, so the front row is
               marked — but only when the sort still means "in front". Sort by
               name, or ascending, and the top row is just the first one
               alphabetically or the worst score, which is not a lead.

               Only first. Tinting the top three flattens the gap between the
               winner and the pack, which is the one thing a standing is for. */
            const leading = index === 0 && sortKey !== NAME_KEY && descending && sorted.length > 1

            return (
              <tr
                key={row.id}
                className={`group/row border-base-content/8 hover:bg-base-content/5 relative border-b transition-colors duration-150 last:border-0 ${
                  leading ? 'bg-accent/[0.06]' : ''
                }`}
              >
                <td className={`relative px-3 py-2 ${wide ? '' : 'max-w-0'}`}>
                  {leading && (
                    <span
                      className="bg-accent absolute inset-y-0 left-0 w-0.5"
                      aria-hidden="true"
                    />
                  )}
                  {/* `block truncate` inside the `max-w-0` cell above is what
                      makes a long name give way instead of widening a narrow
                      table. On desktop the name column is a fixed `w-40`, so it
                      keeps the plain inline treatment it always had — applying
                      both there collapsed the column and let the tally sprawl
                      across it. */}
                  <span className="flex min-w-0 items-center gap-1.5">
                    {/* Every row can be renamed, linked or not. The label is
                        this board's own name for somebody — a crew calling
                        Brett "Bretty" on their Pummel Party table is the point,
                        not a mistake — and it overrides the account name only
                        here. The account link and the tallies are untouched. */}
                    {editing && onRenameRow ? (
                      // Keyed on the name so a swap re-seeds the box: the draft
                      // is state, and state survives a prop change — without
                      // this the field kept the old name after swapping in a
                      // friend, which is exactly when you want to see theirs.
                      <RowName
                        key={row.display_name}
                        name={row.display_name}
                        onRename={(label) => onRenameRow(row.id, label)}
                      />
                    ) : (
                      <span className={wide ? 'font-medium' : 'truncate font-medium'}>
                        {row.display_name}
                      </span>
                    )}

                    {/* Same pairing the roster uses: amber for your own
                        account, blue for a friend's. A row with neither is a
                        plain name somebody typed.

                        In edit mode the badge is the unlink control, because
                        the icon is already the thing that says "this row is a
                        person" — clicking it to stop being that person is the
                        gesture people reach for. The label and the tallies
                        stay; only the account link goes. */}
                    {(row.is_self || row.is_friend) &&
                      (editing && onUnlinkRow ? (
                        <button
                          type="button"
                          onClick={() => onUnlinkRow(row.id)}
                          aria-label={`Unlink ${row.display_name} from their account`}
                          title="Unlink this account — the name and tallies stay"
                          className={`group/unlink hover:bg-error/10 relative grid h-5 w-5 shrink-0 place-items-center rounded transition-colors ${
                            row.is_self ? 'text-accent' : 'text-primary'
                          }`}
                        >
                          {/* The badge at rest, a cross on hover — one slot, so
                              the row does not shift as they swap. */}
                          {row.is_self ? (
                            <User className="absolute h-3.5 w-3.5 transition-opacity group-hover/unlink:opacity-0" />
                          ) : (
                            <Users className="absolute h-3.5 w-3.5 transition-opacity group-hover/unlink:opacity-0" />
                          )}
                          <X className="text-error absolute h-3.5 w-3.5 opacity-0 transition-opacity group-hover/unlink:opacity-100" />
                        </button>
                      ) : row.is_self ? (
                        <User
                          className="text-accent h-3.5 w-3.5 shrink-0"
                          aria-label="You"
                          role="img"
                        />
                      ) : (
                        <Users
                          className="text-primary h-3.5 w-3.5 shrink-0"
                          aria-label="Friend"
                          role="img"
                        />
                      ))}

                    {editing && onSwapRow && (
                      <SwapRow
                        row={row}
                        friends={friends}
                        taken={table.rows}
                        onSwap={(playerId, label) => onSwapRow(row.id, playerId, label)}
                      />
                    )}
                  </span>
                </td>

                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`py-2 ${wide ? 'px-3' : 'w-px px-2'} ${ROLE_TONE[column.role] ?? ''}`}
                  >
                    <TallyCell
                      count={row.counts?.[column.id] ?? 0}
                      emoji={column.emoji}
                      display={displayFor(column)}
                      // Automatic columns are computed from the bracket, so they
                      // have no +/- : editing one by hand would be overwritten
                      // the next time a result was reported, which is worse than
                      // not offering it.
                      canEdit={canEdit && column.role === 'manual'}
                      busy={busyKey === `${row.id}:${column.id}`}
                      onAward={(delta) => onAward(row.id, column.id, delta)}
                    />
                  </td>
                ))}

                {canEdit && (
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row)}
                      aria-label={`Remove ${row.display_name}`}
                      className="text-base-content/30 hover:text-error hover:bg-error/10 grid h-7 w-7 place-items-center rounded-lg opacity-0 transition-all duration-150 group-hover/row:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Rename a column and change its mark, in place.
 *
 * Deliberately not a modal: the header is where a column's name is read, so it
 * is where changing it belongs — and a dialog for two short fields is more
 * chrome than the edit deserves.
 *
 * `role` is not offered. What a column counts is structural, and the serializer
 * refuses it for the reason its own comment gives: changing it would silently
 * rewrite what the numbers already in it meant.
 */
function ColumnEditor({ column, onSave, onRemove }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(column.name)
  const [emoji, setEmoji] = useState(column.emoji)

  const commit = () => {
    const next = name.trim()
    const changed = (next && next !== column.name) || emoji !== column.emoji

    if (changed) onSave({ name: next || column.name, emoji })
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={`Edit the ${column.name} column`}
      title="Rename or change the mark"
      icon={<Pencil className="h-3 w-3" />}
    >
      <span className="flex flex-col gap-2 p-0.5">
        <input
          className="glass-inset focus:border-primary/50 h-8 w-full px-2 text-sm font-normal transition-colors focus:outline-none"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setName(column.name)
              setEmoji(column.emoji)
              setOpen(false)
            }
          }}
          aria-label="Column name"
        />

        <input
          className="glass-inset focus:border-primary/50 h-8 w-full px-2 text-sm font-normal transition-colors focus:outline-none"
          value={emoji}
          maxLength={16}
          onChange={(event) => setEmoji(event.target.value)}
          aria-label="Column mark"
        />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={commit}
            className="bg-primary text-primary-content hover:bg-primary/90 h-8 flex-1 rounded-lg text-xs font-semibold transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(column.name)
              setEmoji(column.emoji)
              setOpen(false)
            }}
            className="text-base-content/60 hover:bg-base-content/8 h-8 rounded-lg px-2 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onRemove()
            }}
            aria-label={`Delete the ${column.name} column`}
            title="Delete this column"
            className="text-base-content/40 hover:text-error hover:bg-error/10 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </span>
    </Popover>
  )
}

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
function SwapRow({ row, friends, taken, onSwap }) {
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

/**
 * A small menu hung off a trigger button.
 *
 * Rendered in a portal on `document.body`, positioned from the trigger's own
 * rectangle.
 *
 * Neither absolute nor fixed works in place here, for two different reasons.
 * Absolute is clipped by the table's `overflow-x-auto` scroller. Fixed escapes
 * the scroller but not the card: `.glass-panel` sets `backdrop-filter`, and a
 * non-none backdrop-filter makes an element a containing block for fixed
 * descendants *and* opens a stacking context — so the panel was positioned
 * against the card and stacked inside it, which is why it appeared behind the
 * page rather than over it.
 *
 * A portal sidesteps both: the panel is a child of body, above every card, and
 * clipped by nothing.
 *
 * Flipped by measurement rather than by row index: whether there is room below
 * is a question about the viewport, and inferring it from "is this one of the
 * last two rows" is right only until the page is scrolled.
 *
 * Dismisses on any press outside it, on Escape, and on scroll — a panel pinned
 * to viewport coordinates would otherwise drift away from the row it belongs
 * to.
 *
 * The last measurement is left behind on close rather than cleared: the panel
 * renders only while open, so a stale coordinate is never drawn, and the next
 * open measures again before paint. Clearing it would be a setState in the
 * effect body for no visible benefit.
 */
function Popover({ open, onOpenChange, label, title, icon, children }) {
  const trigger = useRef(null)
  const panel = useRef(null)
  const [place, setPlace] = useState(null)

  useEffect(() => {
    if (!open) return

    const WIDTH = 224
    const ESTIMATED = 260

    const locate = () => {
      const box = trigger.current?.getBoundingClientRect()
      if (!box) return

      const below = window.innerHeight - box.bottom

      setPlace({
        // Kept on screen horizontally too: a trigger near the right edge would
        // otherwise hang the panel off it.
        left: Math.min(Math.max(8, box.left), window.innerWidth - WIDTH - 8),
        ...(below < ESTIMATED && box.top > ESTIMATED
          ? { bottom: window.innerHeight - box.top + 6 }
          : { top: box.bottom + 6 }),
      })
    }

    locate()

    const dismiss = (event) => {
      if (panel.current?.contains(event.target)) return
      if (trigger.current?.contains(event.target)) return
      onOpenChange(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    const close = () => onOpenChange(false)

    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', onKeyDown)
    // Capture, so a scroll inside the table's own scroller counts as well.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', locate)

    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', locate)
    }
  }, [open, onOpenChange])

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={label}
        title={title}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded transition-colors ${
          open
            ? 'text-primary bg-primary/10'
            : 'text-base-content/35 hover:text-primary hover:bg-primary/10'
        }`}
      >
        {icon}
      </button>

      {open &&
        place &&
        createPortal(
          <div
            ref={panel}
            style={{ ...place, width: '14rem' }}
            className="glass-raised fixed z-[60] flex flex-col gap-0.5 p-1.5 normal-case shadow-xl"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}

/**
 * A competitor's name, editable in place.
 *
 * Same gesture as the table and board names: commits on blur as well as Enter,
 * because renaming and then clicking straight back into the board is the
 * natural thing to do, and losing the edit for want of a keypress is the kind
 * of thing you only notice afterwards. Escape puts it back.
 *
 * Writes `label`, which is the row's own name. For a row linked to an account
 * that label takes precedence over the account's — so naming a friend something
 * else here is allowed, and that row then stops following their renames. Their
 * tallies and their link are untouched either way.
 */
function RowName({ name, onRename }) {
  const [draft, setDraft] = useState(name)

  const commit = () => {
    const next = draft.trim()
    if (next && next !== name) onRename(next)
    else setDraft(name)
  }

  return (
    <input
      className="glass-inset focus:border-primary/50 h-7 w-full min-w-0 px-2 text-sm font-medium transition-colors focus:outline-none"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setDraft(name)
          event.currentTarget.blur()
        }
      }}
      aria-label={`Rename ${name}`}
    />
  )
}
