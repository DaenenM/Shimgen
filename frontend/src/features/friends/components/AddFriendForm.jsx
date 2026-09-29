import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { unwrapList } from '@/api/client'
import { auth } from '@/api/endpoints'
import { UserPlus } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { useDismiss } from '@/hooks/useDismiss'
import { queryKeys } from '@/lib/queryClient'

// @handle input with live suggestions. Used by FriendsPage.jsx.
// `connectedIds` are excluded from suggestions (see useFriends).
export function AddFriendForm({ request, connectedIds }) {
  const [identifier, setIdentifier] = useState('')

  // Debounced separately from the input so typing stays instant.
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  const search = useDebouncedCallback(setTerm, 250)
  useDismiss(box, open, () => setOpen(false))

  // Matches the server's own minimum length; asking sooner is a guaranteed empty result.
  const showSuggestions = open && term.length >= 2

  const { data: found, isFetching } = useQuery({
    queryKey: queryKeys.auth.search(term),
    queryFn: () => auth.searchUsers(term),
    enabled: showSuggestions,
    staleTime: 60_000,
  })

  // `/auth/users/` returns a paginated envelope, unlike the friends endpoints (bare arrays).
  const suggestions = unwrapList(found).filter((person) => !connectedIds.has(person.id))

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
      // Discourages password managers from treating this as a login form.
      autoComplete="off"
      data-lpignore="true"
      data-form-type="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (identifier.trim()) send(identifier)
      }}
    >
      {/* Handle, not email: something safe to say out loud or paste in a group chat. */}
      <div className="glass-inset focus-within:border-primary/50 flex h-11 flex-1 items-center px-3 transition-colors">
        <span className="text-base-content/40 shrink-0 text-sm">@</span>
        <input
          // type="search" avoids Chrome/Firefox login-manager heuristics that
          // autocomplete="off" alone doesn't stop.
          type="search"
          name="friend-handle"
          id="friend-handle"
          className="placeholder:text-base-content/35 min-w-0 flex-1 bg-transparent pl-0.5 text-sm focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          placeholder="username"
          value={identifier}
          onChange={(e) => {
            // Strip a leading @ since the field already renders one.
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

      {/* Anchored to the form, not the field, so it spans input + Add button. */}
      {showSuggestions && (
        <ul
          id="friend-suggestions"
          role="listbox"
          className="glass-raised absolute inset-x-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto p-1.5"
        >
          {isFetching && suggestions.length === 0 ? (
            <li className="text-base-content/50 px-2.5 py-2 text-sm">Searching...</li>
          ) : suggestions.length === 0 ? (
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
