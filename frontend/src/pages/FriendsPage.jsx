import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, UserPlus, Users, X } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'

import { auth, friends as friendsApi } from '@/api/endpoints'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCards } from '@/components/ui/Skeleton'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { queryKeys } from '@/lib/queryClient'

/**
 * Friends.
 *
 * Not a social feature for its own sake: linking accounts is what gives stats
 * continuity across different hosts' events (plan §3), so results follow the
 * person rather than the roster entry they happened to be added under.
 */
export function FriendsPage() {
  const queryClient = useQueryClient()
  const [identifier, setIdentifier] = useState('')

  // What the suggestion list is querying, kept separate from the input so
  // typing stays instant while the request waits for a pause. Binding the query
  // straight to the field would fire one per keystroke.
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  const search = useDebouncedCallback(setTerm, 250)

  const { data: accepted, isLoading } = useQuery({
    queryKey: queryKeys.friends.accepted,
    queryFn: friendsApi.list,
  })

  const { data: pending } = useQuery({
    queryKey: queryKeys.friends.pending,
    queryFn: friendsApi.pending,
  })

  const { data: sent } = useQuery({
    queryKey: queryKeys.friends.sent,
    queryFn: friendsApi.sent,
  })

  // Prefix-matching, so this covers both lists and the nav's pending count.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.friends.all })

  const request = useMutation({
    // Takes the handle so a suggestion can be sent on click, rather than going
    // through the input and waiting a render for it to catch up.
    mutationFn: (handle) => friendsApi.request((handle ?? identifier).trim()),
    onSuccess: () => {
      setIdentifier('')
      setTerm('')
      setOpen(false)
      invalidate()
    },
  })

  const accept = useMutation({ mutationFn: friendsApi.accept, onSuccess: invalidate })
  const remove = useMutation({ mutationFn: friendsApi.remove, onSuccess: invalidate })

  const friends = accepted ?? []
  const requests = pending ?? []
  const outgoing = sent ?? []

  // Two characters is the server's own floor, so asking sooner is a guaranteed
  // empty round trip.
  const { data: found, isFetching } = useQuery({
    queryKey: queryKeys.auth.search(term),
    queryFn: () => auth.searchUsers(term),
    enabled: open && term.length >= 2,
    // A handle does not change while somebody is typing one.
    staleTime: 60_000,
  })

  const showSuggestions = open && term.length >= 2

  // Anyone already connected is dropped. Offering them would produce a
  // guaranteed 400 from the server -- already friends, request already pending
  // -- which is a worse answer than not offering them at all.
  const connected = new Set(
    [...friends, ...requests, ...outgoing].flatMap((item) =>
      [item.from_user?.id, item.to_user?.id].filter(Boolean),
    ),
  )

  // `/auth/users/` is a paginated list view, so it answers with an envelope —
  // unlike the friends endpoints, which are actions returning a bare array.
  // Same unwrapping as every other list in the app.
  const suggestions = (found?.results ?? found ?? []).filter((person) => !connected.has(person.id))

  // Click-away and Escape, matching every other popover on the site.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      if (!box.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="glass-backdrop mx-auto max-w-2xl px-4 py-8">
      {/* Header and the add form. The friends list itself re-renders on every
          request, accept and removal. */}
      <PageHeader
        className="rise-in rise-delay-1"
        title="Friends"
        description="Add someone by their @username. Linking accounts keeps everyone's stats together across whoever is hosting."
      />

      <form
        className="rise-in rise-delay-2 relative mb-6 flex gap-2"
        ref={box}
        // Nothing here is a credential. Saying so on the form as well as the
        // field matters: a manager that ignores the input's own hint will still
        // respect the form having no login fields to fill.
        autoComplete="off"
        data-lpignore="true"
        data-form-type="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (identifier.trim()) request.mutate()
        }}
      >
        {/* Handle only, not email. A handle is the thing somebody can read out
            across a room or paste into a group chat without giving away an
            address — and it is why usernames are unique while display names
            are not. The `@` is rendered rather than typed; the server strips
            one anyway, for people who type it the way they see it written. */}
        <div className="glass-inset focus-within:border-primary/50 flex h-11 flex-1 items-center px-3 transition-colors">
          <span className="text-base-content/40 shrink-0 text-sm">@</span>
          <input
            // `type="search"` rather than text, and a name that reads as
            // nothing like a credential. Chrome and Firefox deliberately ignore
            // `autocomplete="off"` on fields their heuristics classify as a
            // login — a lone text input inside a form, labelled "username",
            // is the textbook shape — so the fix is to stop looking like one
            // rather than to ask more firmly. A search field is never offered
            // saved credentials, and it is what this genuinely is.
            type="search"
            name="friend-handle"
            id="friend-handle"
            className="placeholder:text-base-content/35 min-w-0 flex-1 bg-transparent pl-0.5 text-sm focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            placeholder="username"
            value={identifier}
            onChange={(e) => {
              // A pasted handle often arrives with the @ already on it, and the
              // field renders its own.
              const next = e.target.value.replace(/^@/, '')
              setIdentifier(next)
              setOpen(true)
              search(next.trim())
            }}
            onFocus={() => setOpen(true)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            autoComplete="off"
            role="combobox"
            aria-label="Find someone by their username"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls="friend-suggestions"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          disabled={request.isPending}
        >
          <UserPlus className="h-4 w-4" />
          Add
        </button>

        {/* Anchored to the form rather than to the field, so it spans the input
            and the Add button together: a narrower panel under one flex child
            reads as detached from the row that opened it. */}
        {showSuggestions && (
          <ul
            id="friend-suggestions"
            role="listbox"
            className="glass-raised absolute inset-x-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto p-1.5"
          >
            {isFetching && suggestions.length === 0 ? (
              <li className="text-base-content/50 px-2.5 py-2 text-sm">Searching...</li>
            ) : suggestions.length === 0 ? (
              // Said plainly rather than left blank: an empty panel reads as
              // still loading, and the handle may simply not exist.
              <li className="text-base-content/50 px-2.5 py-2 text-sm">
                No one found for @{identifier.trim()}
              </li>
            ) : (
              suggestions.map((person) => (
                <li key={person.id} role="option" aria-selected="false">
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier(person.username)
                      setOpen(false)
                      request.mutate(person.username)
                    }}
                    disabled={request.isPending}
                    className="hover:bg-primary/10 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-40"
                  >
                    {/* The same single initial the account menu draws, so a
                        person looks the same wherever they appear. */}
                    <span className="from-primary to-secondary text-primary-content grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-xs font-bold">
                      {(person.name || person.username).slice(0, 1).toUpperCase()}
                    </span>

                    <span className="min-w-0 flex-1">
                      {/* Display name leads because that is what people
                          recognise; the handle sits under it because that is
                          what actually addresses the request. */}
                      <span className="block truncate text-sm font-medium">{person.name}</span>
                      <span className="text-base-content/50 block truncate text-xs">
                        @{person.username}
                      </span>
                    </span>

                    <UserPlus className="text-base-content/40 h-4 w-4 shrink-0" />
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </form>

      {request.isError && (
        <div
          role="alert"
          className="border-error/30 bg-error/12 text-error mb-4 rounded-xl border px-3 py-2 text-sm"
        >
          {request.error.message}
        </div>
      )}

      {requests.length > 0 && (
        // Above the friends list and visually louder than it: a request is the
        // one thing on this page that is waiting on you.
        <section className="border-primary/40 bg-primary/5 mb-6 rounded-xl border p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="text-primary h-4 w-4" />
            {requests.length === 1 ? '1 friend request' : `${requests.length} friend requests`}
          </h2>

          <ul className="grid gap-2">
            {requests.map((item) => (
              <li key={item.id} className="glass-inset">
                <div className="flex flex-row items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.from_user.name}</p>
                    {/* The handle under the name, quieter than it: the name is
                        who they are, the handle is how they are addressed. */}
                    <p className="text-base-content/50 truncate text-xs">
                      @{item.from_user.username}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                      disabled={accept.isPending}
                      onClick={() => accept.mutate(item.id)}
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </button>
                    <button
                      className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content hover:text-error inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
                      onClick={() => remove.mutate(item.id)}
                      aria-label={`Decline request from ${item.from_user.name}`}
                      title="Decline"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base-content/60 mb-2 text-xs font-semibold tracking-wide uppercase">
            Sent, awaiting a reply
          </h2>
          <ul className="grid gap-2">
            {outgoing.map((item) => (
              <li key={item.id} className="glass-inset">
                <div className="flex flex-row items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.to_user.name}</p>
                    <p className="text-base-content/50 truncate text-xs">
                      @{item.to_user.username}
                    </p>
                  </div>
                  <button
                    className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content hover:text-error inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
                    onClick={() => remove.mutate(item.id)}
                    aria-label={`Cancel request to ${item.to_user.name}`}
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="text-base-content/60 mb-2 text-xs font-semibold tracking-wide uppercase">
        Friends
      </h2>

      {isLoading ? (
        <SkeletonCards count={4} />
      ) : friends.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No friends yet"
          description="Add someone by their @username. Once they accept, their results follow them across every group you both play in."
        />
      ) : (
        <ul className="grid gap-2">
          {friends.map((item) => {
            // The friendship is stored directionally, so which side is "them"
            // depends on who sent the original request.
            const them = item.direction === 'outgoing' ? item.to_user : item.from_user

            return (
              <li key={item.id} className="glass-inset">
                <div className="flex flex-row items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{them.name}</p>
                    <p className="text-base-content/50 truncate text-xs">@{them.username}</p>
                  </div>
                  <button
                    className="text-error hover:bg-error/10 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors duration-150"
                    onClick={() => remove.mutate(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
