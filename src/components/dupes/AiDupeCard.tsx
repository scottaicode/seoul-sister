'use client'

import { DollarSign, FlaskConical, ShoppingBag } from 'lucide-react'

interface AiDupe {
  name: string
  brand: string
  estimated_price_usd: number
  key_shared_actives: string[]
  match_reasoning: string
  key_differences: string
  where_to_buy: string
}

interface AiDupeCardProps {
  dupe: AiDupe
  rank: number
}

export default function AiDupeCard({ dupe, rank }: AiDupeCardProps) {
  return (
    <div className="glass-card p-4 space-y-2.5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-white">{dupe.name}</p>
          <p className="text-xs text-white/40">{dupe.brand}</p>
        </div>
        {dupe.estimated_price_usd > 0 && (
          <span className="flex items-center gap-1 text-sm font-display font-bold text-emerald-300 flex-shrink-0">
            <DollarSign className="w-3.5 h-3.5" />
            {dupe.estimated_price_usd}
          </span>
        )}
      </div>

      {/* Shared actives */}
      {dupe.key_shared_actives.length > 0 && (
        <div className="flex items-start gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex flex-wrap gap-1">
            {dupe.key_shared_actives.map(active => (
              <span
                key={active}
                className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-300/80"
              >
                {active}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning */}
      <p className="text-xs text-white/60 leading-relaxed">{dupe.match_reasoning}</p>

      {/* Differences */}
      {dupe.key_differences && (
        <p className="text-[10px] text-white/40 italic">
          Differences: {dupe.key_differences}
        </p>
      )}

      {/* Where to buy */}
      {dupe.where_to_buy && (
        <div className="flex items-center gap-1.5 text-[10px] text-gold/70">
          <ShoppingBag className="w-3 h-3" />
          {dupe.where_to_buy}
        </div>
      )}
    </div>
  )
}
