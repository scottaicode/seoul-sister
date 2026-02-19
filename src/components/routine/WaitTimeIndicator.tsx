'use client'

import { Clock } from 'lucide-react'

interface WaitTimeSuggestion {
  after_step: number
  product_name: string
  wait_minutes: number
  reason: string
}

export function WaitTimeIndicator({ suggestion }: { suggestion: WaitTimeSuggestion }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 my-1 bg-blue-500/5 border border-blue-500/10 rounded-lg">
      <Clock className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-medium text-blue-400">
          Wait {suggestion.wait_minutes} min
        </span>
        <span className="text-[10px] text-white/30 ml-1.5">
          {suggestion.reason}
        </span>
      </div>
    </div>
  )
}
