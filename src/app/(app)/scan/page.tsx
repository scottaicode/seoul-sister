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
          <strong className="text-white">How it works:</strong> Take a photo of any Korean product label.
          Our AI reads the Korean text, extracts every ingredient, and gives you a complete safety analysis
          with conflict warnings and skin-type recommendations.
        </p>
      </div>

      {/* Scanner */}
      <LabelScanner />

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}
