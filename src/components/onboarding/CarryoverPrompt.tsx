'use client'

import { Sparkles } from 'lucide-react'

/**
 * Asked once, before onboarding starts, when this browser holds a free-preview
 * conversation. The preview is carried into onboarding only on "Yes": a browser
 * can be shared, so loading it silently could put someone else's skin
 * conversation in front of a different account holder.
 */
export default function CarryoverPrompt({
  onChoose,
  previewedAt,
}: {
  onChoose: (choice: 'yes' | 'no') => void
  previewedAt?: string | null
}) {
  // A date lets someone on a shared browser actually tell whether it was them.
  const when = previewedAt
    ? new Date(previewedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null
  return (
    <div className="min-h-screen bg-seoul-darker flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-gold to-gold-light shadow-glow-gold mb-4">
          <Sparkles className="w-7 h-7 text-seoul-dark" />
        </div>
        <h1 className="font-display text-lg font-semibold text-white mb-2">
          Continue from your earlier chat?
        </h1>
        <p className="text-sm text-white/60 mb-6">
          There&apos;s a conversation with Yuri on this device from before you signed up{when ? ` (last message ${when})` : ''}.
          If it was you, she can pick up from it instead of starting over.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onChoose('yes')}
            className="glass-button-primary text-sm py-3 px-5 min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Yes, that was me
          </button>
          <button
            type="button"
            onClick={() => onChoose('no')}
            className="text-sm text-white/60 hover:text-white py-3 px-5 min-h-[44px] rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            No, start fresh
          </button>
        </div>
      </div>
    </div>
  )
}
