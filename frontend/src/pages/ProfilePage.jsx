import { LogOut } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProfileForm } from '@/features/auth/components/ProfileForm'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useProfileForm } from '@/features/auth/hooks/useProfileForm'

// Profile settings + sign out. Route: /profile
export function ProfilePage() {
  const { logout } = useAuth()
  const profile = useProfileForm()

  return (
    <div className="glass-backdrop mx-auto max-w-xl px-4 py-8">
      <div className="rise-in rise-delay-1">
        <PageHeader title="Profile" description="How you appear on leaderboards and brackets." />
      </div>

      <div className="glass-panel rise-in rise-delay-2">
        <ProfileForm profile={profile} />
      </div>

      {/* No panel/heading needed — the button says what it does.
          Bordered danger style, not ConfirmDialog's solid fill: signing out
          loses nothing, so it doesn't need that weight. */}
      <div className="rise-in rise-delay-3 mt-6">
        <Button variant="danger" icon={LogOut} size="sm" onClick={logout}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
