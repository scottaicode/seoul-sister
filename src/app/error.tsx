'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[var(--seoul-cream)] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">😿</div>
        <h1 className="font-display text-2xl font-bold text-[var(--seoul-charcoal)] mb-2">
          Something went wrong
        </h1>
        <p className="text-[var(--seoul-charcoal)]/60 mb-6">
          An unexpected error occurred. This has been logged and we&apos;ll look into it.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-[var(--gold)] text-white rounded-xl font-medium hover:bg-[var(--gold-light)] transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 border border-[var(--seoul-card-border)] text-[var(--seoul-charcoal)] rounded-xl font-medium hover:bg-white/50 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
