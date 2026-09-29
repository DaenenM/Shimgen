import { LogOut } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProfileForm } from '@/features/auth/components/ProfileForm'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useProfileForm } from '@/features/auth/hooks/useProfileForm'

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

      {/* The button alone, with no panel around it. A heading and a sentence
          explaining what signing out does was scaffolding around a control that
          already says what it does — and a glass card holding one small button
          reads as a section that lost its content.

          Red and bordered, the same register as every other destructive control
          in the app. Not the solid `bg-error` fill `ConfirmDialog` uses: that is
          reserved for commits that destroy something, and signing out loses
          nothing. */}
      <div className="rise-in rise-delay-3 mt-6">
        <Button variant="danger" icon={LogOut} size="sm" onClick={logout}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
