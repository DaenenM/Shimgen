import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { auth } from '@/api/endpoints'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/hooks/useAuth'

export function ProfilePage() {
  const { user, setUser, logout } = useAuth()
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: () => auth.updateMe({ display_name: displayName.trim() }),
    onSuccess: (updated) => {
      setUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="glass-backdrop mx-auto max-w-xl px-4 py-8">
      <PageHeader title="Profile" description="How you appear on leaderboards and brackets." />

      <div className="glass-panel">
        <form
          className="flex flex-col gap-4 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <label className="form-control">
            <span className="label-text mb-1">Display name</span>
            <input
              className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-11 w-full px-3 text-sm transition-colors focus:outline-none"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={user?.username}
            />
            <span className="text-base-content/50 mt-1 text-xs">
              Falls back to your username when empty.
            </span>
          </label>

          <label className="form-control">
            <span className="label-text mb-1">Email</span>
            <input
              className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-11 w-full px-3 text-sm transition-colors focus:outline-none disabled:opacity-50"
              value={user?.email ?? ''}
              disabled
            />
            <span className="text-base-content/50 mt-1 text-xs">
              Your email is how you sign in and cannot be changed here.
            </span>
          </label>

          <label className="form-control">
            <span className="label-text mb-1">Username</span>
            <input
              className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-11 w-full px-3 text-sm transition-colors focus:outline-none disabled:opacity-50"
              value={user?.username ?? ''}
              disabled
            />
          </label>

          {save.isError && (
            <div
              role="alert"
              className="border-error/30 bg-error/12 text-error rounded-xl border px-3 py-2 text-sm"
            >
              {save.error.message}
            </div>
          )}

          <button
            type="submit"
            className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            disabled={save.isPending}
          >
            {save.isPending && <span className="loading loading-spinner loading-sm" />}
            {saved ? 'Saved' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="glass-panel mt-6">
        <div className="p-4">
          <h2 className="text-sm font-semibold">Session</h2>
          <p className="text-base-content/60 mb-2 text-sm">
            Signing out clears your tokens on this device.
          </p>
          <button
            className="glass-raised hover:border-base-content/30 hover:bg-base-content/5 inline-flex h-9 w-fit items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
