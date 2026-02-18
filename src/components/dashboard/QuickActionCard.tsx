import Link from 'next/link'

export default function QuickActionCard({
  icon: Icon,
  label,
  description,
  href,
  accent = false,
}: {
  icon: React.ElementType
  label: string
  description: string
  href: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex-shrink-0 w-40 md:w-auto rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-300 group ${
        accent
          ? 'border-gold/30 bg-gold/5 hover:bg-gold/10 hover:shadow-glow-gold'
          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
      }`}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 ${
          accent
            ? 'bg-gradient-to-br from-gold to-gold-light text-seoul-dark'
            : 'bg-white/10 text-gold group-hover:bg-gold/15'
        }`}
      >
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <div>
        <p className="font-display font-semibold text-sm text-white">{label}</p>
        <p className="text-xs text-white/40 mt-0.5 leading-snug">{description}</p>
      </div>
    </Link>
  )
}
