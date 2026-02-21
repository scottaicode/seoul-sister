import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--seoul-cream)] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="font-display text-2xl font-bold text-[var(--seoul-charcoal)] mb-2">
          Page not found
        </h1>
        <p className="text-[var(--seoul-charcoal)]/60 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-[var(--gold)] text-white rounded-xl font-medium hover:bg-[var(--gold-light)] transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/products"
            className="px-5 py-2.5 border border-[var(--seoul-card-border)] text-[var(--seoul-charcoal)] rounded-xl font-medium hover:bg-white/50 transition-colors"
          >
            Browse Products
          </Link>
        </div>
      </div>
    </div>
  )
}
