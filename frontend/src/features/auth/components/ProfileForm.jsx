import { ErrorAlert } from '@/components/ui/ErrorAlert'

import { AuthField } from './AuthField'
import { SubmitButton } from './SubmitButton'

// Display name and username editor, with email shown for reference.
// Used by ProfilePage.jsx.
export function ProfileForm({ profile }) {
  const { user, displayName, setDisplayName, username, setUsername, saved, save } = profile

  return (
    <form
      className="flex flex-col gap-4 p-5 sm:p-6"
      // No credential fields here; email is disabled/reference-only.
      autoComplete="off"
      data-lpignore="true"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <AuthField
        label="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder={user?.username}
        hint="Shown on brackets and leaderboards. Does not have to be unique — falls back to your username when empty."
      />

      {/* Username must be unique — it's how friend requests are addressed. */}
      <label className="form-control">
        <span className="label-text mb-1">Username</span>
        <div className="glass-inset focus-within:border-primary/50 flex h-11 w-full items-center px-3 transition-colors">
          <span className="text-base-content/40 shrink-0 text-sm">@</span>
          <input
            // Not autoComplete="username" — would invite a password manager to fill/save an email here.
            name="profile-handle"
            id="profile-handle"
            className="placeholder:text-base-content/35 min-w-0 flex-1 bg-transparent pl-0.5 text-sm focus:outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            autoComplete="off"
            data-lpignore="true"
            aria-label="Your username"
          />
        </div>
        <span className="text-base-content/50 mt-1 text-xs">
          Letters, numbers and underscores. This is what friends type to add you.
        </span>
      </label>

      <AuthField
        label="Email"
        value={user?.email ?? ''}
        disabled
        hint="Your email is how you sign in and cannot be changed here."
      />

      <ErrorAlert>{save.error?.message}</ErrorAlert>

      <SubmitButton busy={save.isPending}>{saved ? 'Saved' : 'Save changes'}</SubmitButton>
    </form>
  )
}
