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
    <div className="mx-auto max-w-xl px-4 py-8">
      <PageHeader title="Profile" description="How you appear on leaderboards and brackets." />

      <div className="card bg-base-100 border-base-300 border">
        <form
          className="card-body gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <label className="form-control">
            <span className="label-text mb-1">Display name</span>
            <input
              className="input input-bordered w-full"
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
            <input className="input input-bordered w-full" value={user?.email ?? ''} disabled />
            <span className="text-base-content/50 mt-1 text-xs">
              Your email is how you sign in and cannot be changed here.
            </span>
          </label>

          <label className="form-control">
            <span className="label-text mb-1">Username</span>
            <input className="input input-bordered w-full" value={user?.username ?? ''} disabled />
          </label>

          {save.isError && (
            <div role="alert" className="alert alert-error py-2 text-sm">
              {save.error.message}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending && <span className="loading loading-spinner loading-sm" />}
            {saved ? 'Saved' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card bg-base-100 border-base-300 mt-6 border">
        <div className="card-body p-4">
          <h2 className="text-sm font-semibold">Session</h2>
          <p className="text-base-content/60 mb-2 text-sm">
            Signing out clears your tokens on this device.
          </p>
          <button className="btn btn-outline btn-sm w-fit" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
