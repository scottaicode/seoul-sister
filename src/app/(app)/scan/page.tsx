'use client'

import dynamic from 'next/dynamic'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const LabelScanner = dynamic(() => import('@/components/scan/LabelScanner'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>,
})

export default function ScanPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-bold text-2xl text-white">
          Korean Label Scanner
        </h1>
        <p className="text-white/40 text-sm">
          Decode any Korean beauty product label instantly with AI vision.
        </p>
      </div>

      {/* How it works */}
      <div className="glass-card p-4">
        <p className="text-xs text-white/40 leading-relaxed">
          <strong className="text-white">How it works:</strong> Photograph the{' '}
          <strong className="text-white/70">back</strong> for the ingredient list, then add the{' '}
          <strong className="text-white/70">front</strong> for the name and brand — the camera takes
          one shot at a time, so use &ldquo;Add other side&rdquo; for the second. Yuri reads the
          Korean text, extracts every ingredient, and gives you personalized intelligence: safety
          analysis, skin-type match, price comparison, community reviews, and authenticity
          verification.
        </p>
        <p className="text-xs text-white/30 leading-relaxed mt-2">
          For the ingredient list, shoot the back panel straight-on in even light. Backlighting a
          glossy package (against a window or bright sky) is the most common reason a label
          can&rsquo;t be read.
        </p>
      </div>

      {/* Scanner */}
      <LabelScanner />

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}
