import { useQuery } from '@tanstack/react-query'
import { UserPlus } from '@/components/icons'
import { useRef, useState } from 'react'

import { auth } from '@/api/endpoints'
import { Avatar } from '@/components/ui/Avatar'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { useDismiss } from '@/hooks/useDismiss'
import { queryKeys } from '@/lib/queryClient'

/**
 * The @handle input with its live suggestions.
 *
 * `connectedIds` are left out of the suggestions — see `useFriends`.
 */
export function AddFriendForm({ request, connectedIds }) {
  const [identifier, setIdentifier] = useState('')

  // What the suggestion list is querying, kept separate from the input so
  // typing stays instant while the request waits for a pause. Binding the query
  // straight to the field would fire one per keystroke.
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  const search = useDebouncedCallback(setTerm, 250)
  useDismiss(box, open, () => setOpen(false))

  // Two characters is the server's own floor, so asking sooner is a guaranteed
  // empty round trip.
  const showSuggestions = open && term.length >= 2

  const { data: found, isFetching } = useQuery({
    queryKey: queryKeys.auth.search(term),
    queryFn: () => auth.searchUsers(term),
    enabled: showSuggestions,
    // A handle does not change while somebody is typing one.
    staleTime: 60_000,
  })

  // `/auth/users/` is a paginated list view, so it answers with an envelope —
  // unlike the friends endpoints, which are actions returning a bare array.
  const suggestions = (found?.results ?? found ?? []).filter(
    (person) => !connectedIds.has(person.id),
  )

  // Takes the handle so a suggestion can be sent on click, rather than going
  // through the input and waiting a render for it to catch up.
  function send(handle) {
    request.mutate(handle, {
      onSuccess: () => {
        setIdentifier('')
        setTerm('')
        setOpen(false)
      },
    })
  }

  return (
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
        if (identifier.trim()) send(identifier)
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
                    send(person.username)
                  }}
                  disabled={request.isPending}
                  className="hover:bg-primary/10 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-40"
                >
                  <Avatar name={person.name || person.username} />

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
  )
}
