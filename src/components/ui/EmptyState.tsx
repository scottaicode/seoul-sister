import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="glass-card flex flex-col items-center justify-center text-center p-10 gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-seoul-pearl">
        <Icon className="w-7 h-7 text-rose-gold" strokeWidth={1.5} />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-display font-semibold text-lg text-seoul-charcoal">{title}</h3>
        <p className="text-seoul-soft text-sm max-w-xs">{description}</p>
      </div>

      {actionLabel && actionHref && (
        <Link href={actionHref} className="glass-button-primary text-sm px-5 py-2.5 mt-1">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
