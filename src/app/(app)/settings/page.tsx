import type { Metadata } from 'next'
import type { LucideIcon } from 'lucide-react'
import { Settings } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

export const metadata: Metadata = {
  title: 'Settings',
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-semibold text-2xl text-seoul-charcoal section-heading">
          Settings
        </h1>
        <p className="text-seoul-soft text-sm">
          Manage your account, subscription, notifications, and privacy settings.
        </p>
      </div>

      <EmptyState
        icon={Settings as LucideIcon}
        title="Account Settings"
        description="Manage your account, subscription, notifications, and privacy settings."
      />
    </div>
  )
}
