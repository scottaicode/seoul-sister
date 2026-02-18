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
    <div className="dark-card-gold flex flex-col items-center justify-center text-center p-10 gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/5">
        <Icon className="w-7 h-7 text-gold/60" strokeWidth={1.5} />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-display font-semibold text-lg text-white">{title}</h3>
        <p className="text-white/40 text-sm max-w-xs">{description}</p>
      </div>

      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all duration-200 mt-1"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
