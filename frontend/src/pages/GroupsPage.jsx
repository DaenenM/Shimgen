import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { groups as groupsApi } from '@/api/endpoints'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/PageLoader'
import { queryKeys } from '@/lib/queryClient'
import { paths } from '@/routes/paths'

/**
 * Groups — the recurring crews everything else hangs off.
 *
 * Stats, ratings and seasons are all scoped to a group, so this is where a
 * casual user turns into a returning one.
 */
export function GroupsPage() {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.groups.all,
    queryFn: groupsApi.list,
  })

  const create = useMutation({
    mutationFn: () => groupsApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all })
      setCreating(false)
      setForm({ name: '', description: '' })
    },
  })

  if (isLoading) return <PageLoader label="Loading groups…" />

  const groups = data?.results ?? data ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Groups" description="Your recurring crews. Stats live here.">
        <button className="btn btn-primary btn-sm gap-2" onClick={() => setCreating((c) => !c)}>
          <Plus className="h-4 w-4" />
          New group
        </button>
      </PageHeader>

      {creating && (
        <div className="card bg-base-100 border-base-300 mb-6 border">
          <form
            className="card-body gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              create.mutate()
            }}
          >
            <label className="form-control">
              <span className="label-text mb-1">Group name</span>
              <input
                className="input input-bordered w-full"
                placeholder="Saturday Crew"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </label>

            <label className="form-control">
              <span className="label-text mb-1">
                Description <span className="text-base-content/40">(optional)</span>
              </span>
              <input
                className="input input-bordered w-full"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>

            {create.isError && (
              <div role="alert" className="alert alert-error py-2 text-sm">
                {create.error.message}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={create.isPending}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="A group is the crew you play with every week. Ratings, leaderboards and seasons all belong to one."
          actionLabel="Create a group"
          onAction={() => setCreating(true)}
        />
      ) : (
        <ul className="grid gap-3">
          {groups.map((group) => (
            <li key={group.slug}>
              <Link
                to={paths.group(group.slug)}
                className="card bg-base-100 border-base-300 border transition-shadow hover:shadow-md"
              >
                <div className="card-body p-4">
                  <h3 className="font-semibold">{group.name}</h3>
                  {group.description && (
                    <p className="text-base-content/60 text-sm">{group.description}</p>
                  )}
                  <p className="text-base-content/50 text-xs">
                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'} ·{' '}
                    {group.player_count} in the roster
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
