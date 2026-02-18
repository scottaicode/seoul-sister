import type { Metadata } from 'next'
import type { LucideIcon } from 'lucide-react'
import { User } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

export const metadata: Metadata = {
  title: 'My Profile',
}

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-semibold text-2xl text-white section-heading">
          My Profile
        </h1>
        <p className="text-white/40 text-sm">
          Your skin profile, preferences, and personalization settings.
        </p>
      </div>

      <EmptyState
        icon={User as LucideIcon}
        title="Your Skin Profile"
        description="View and edit your skin profile, preferences, and settings."
        actionLabel="Edit Profile"
        actionHref="/onboarding"
      />
    </div>
  )
}
