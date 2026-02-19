'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Package,
  Star,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageCircle,
} from 'lucide-react'
import IngredientComparison from './IngredientComparison'

interface DupeProduct {
  id: string
  name_en: string
  name_ko: string
  brand_en: string
  category: string
  price_usd: number | null
  price_krw: number | null
  image_url: string | null
  rating_avg: number | null
  review_count: number
  volume_display: string | null
}

export interface DupeCardProps {
  original: DupeProduct
  dupe: {
    product: DupeProduct
    match_score: number
    shared_ingredients: string[]
    unique_to_original: string[]
    unique_to_dupe: string[]
    price_savings_pct: number
  }
  rank: number
}

export default function DupeCard({ original, dupe, rank }: DupeCardProps) {
  const [expanded, setExpanded] = useState(false)

  const matchPct = Math.round(dupe.match_score * 100)
  const dupePrice = Number(dupe.product.price_usd) || 0
  const originalPrice = Number(original.price_usd) || 0

  return (
    <div className="glass-card overflow-hidden">
      {/* Main card content */}
      <div className="p-4 flex gap-3">
        {/* Rank badge + image */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">
            {rank}
          </span>
          <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
            {dupe.product.image_url ? (
              <img
                src={dupe.product.image_url}
                alt={dupe.product.name_en}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <Package className="w-5 h-5 text-gold/50" strokeWidth={1.5} />
            )}
          </div>
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/products/${dupe.product.id}`}
            className="font-display font-semibold text-sm text-white hover:text-gold transition-colors duration-200 block truncate"
          >
            {dupe.product.name_en}
          </Link>
          <p className="text-xs text-white/40">{dupe.product.brand_en}</p>

          {/* Metrics row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Match score */}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              matchPct >= 70 ? 'bg-emerald-500/20 text-emerald-300' :
              matchPct >= 50 ? 'bg-gold/20 text-gold-light' :
              'bg-white/10 text-white/60'
            }`}>
              {matchPct}% match
            </span>

            {/* Savings */}
            {dupe.price_savings_pct > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                Save {dupe.price_savings_pct}%
              </span>
            )}

            {/* Rating */}
            {dupe.product.rating_avg && (
              <span className="flex items-center gap-0.5 text-[10px] text-white/40">
                <Star className="w-2.5 h-2.5 fill-gold text-gold" />
                {Number(dupe.product.rating_avg).toFixed(1)}
              </span>
            )}
          </div>

          {/* Price comparison */}
          <div className="flex items-center gap-2 mt-1.5">
            {dupePrice > 0 && (
              <span className="font-display font-bold text-sm text-white">
                ${dupePrice.toFixed(0)}
              </span>
            )}
            {originalPrice > 0 && dupePrice > 0 && dupePrice < originalPrice && (
              <span className="text-[10px] text-white/30 line-through">
                ${originalPrice.toFixed(0)}
              </span>
            )}
            {dupe.product.volume_display && (
              <span className="text-[10px] text-white/30">{dupe.product.volume_display}</span>
            )}
          </div>
        </div>
      </div>

      {/* Shared ingredients summary */}
      <div className="px-4 pb-2">
        <p className="text-[10px] text-white/30">
          {dupe.shared_ingredients.length} shared ingredients:
          <span className="text-white/50 ml-1">
            {dupe.shared_ingredients.slice(0, 4).join(', ')}
            {dupe.shared_ingredients.length > 4 && ` +${dupe.shared_ingredients.length - 4} more`}
          </span>
        </p>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-center gap-1.5 text-xs text-gold/70 hover:text-gold border-t border-white/5 transition-colors duration-200"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            Hide comparison
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            View ingredient comparison
          </>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5">
          <IngredientComparison
            originalName={original.name_en}
            dupeName={dupe.product.name_en}
            shared={dupe.shared_ingredients}
            uniqueToOriginal={dupe.unique_to_original}
            uniqueToDupe={dupe.unique_to_dupe}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Link
              href={`/products/${dupe.product.id}`}
              className="flex items-center gap-1.5 glass-button text-xs px-3 py-2"
            >
              <ExternalLink className="w-3 h-3" />
              Full Details
            </Link>
            <Link
              href={`/yuri?ask=${encodeURIComponent(`Compare ${original.name_en} vs ${dupe.product.name_en} as dupes`)}`}
              className="flex items-center gap-1.5 glass-button text-xs px-3 py-2"
            >
              <MessageCircle className="w-3 h-3" />
              Ask Yuri
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
