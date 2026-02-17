import type { Metadata } from 'next'
import type { LucideIcon } from 'lucide-react'
import { Layers } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

export const metadata: Metadata = {
  title: 'My Routine',
}

export default function RoutinePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-semibold text-2xl text-seoul-charcoal section-heading">
          My Routine
        </h1>
        <p className="text-seoul-soft text-sm">
          Your personalized K-beauty AM/PM routine with ingredient conflict detection.
        </p>
      </div>

      <EmptyState
        icon={Layers as LucideIcon}
        title="AI Routine Builder"
        description="Build your personalized K-beauty routine with ingredient conflict detection and skin cycling schedules."
        actionLabel="Build My Routine"
        actionHref="/yuri"
      />
    </div>
  )
}
