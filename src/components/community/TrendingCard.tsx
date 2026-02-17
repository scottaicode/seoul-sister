'use client'

import Link from 'next/link'
import { TrendingUp, Package, Star, MessageSquare, Flame } from 'lucide-react'
import type { Product } from '@/types/database'

interface TrendingCardProps {
  product: Product
  source: string
  trendScore: number
  mentionCount: number
  sentimentScore: number | null
  trendingSince: string
}

const sourceLabels: Record<string, { label: string; color: string }> = {
  tiktok: { label: 'TikTok', color: 'bg-black text-white' },
  reddit: { label: 'Reddit', color: 'bg-orange-100 text-orange-700' },
  instagram: { label: 'Instagram', color: 'bg-purple-100 text-purple-700' },
  korean_market: { label: 'Seoul', color: 'bg-seoul-blush text-rose-dark' },
}

function formatMentions(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

function getDaysAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export default function TrendingCard({
  product,
  source,
  trendScore,
  mentionCount,
  sentimentScore,
  trendingSince,
}: TrendingCardProps) {
  const sourceInfo = sourceLabels[source] ?? { label: source, color: 'bg-gray-100 text-gray-700' }

  return (
    <Link
      href={`/products/${product.id}`}
      className="glass-card p-4 flex gap-3 hover:shadow-glass-lg transition-all duration-300 group"
    >
      {/* Product image */}
      <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-seoul-pearl flex items-center justify-center overflow-hidden relative">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name_en}
            className="w-full h-full object-cover rounded-xl"
          />
        ) : (
          <Package className="w-6 h-6 text-rose-gold/50" strokeWidth={1.5} />
        )}
        {/* Trend score flame */}
        {trendScore >= 80 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
            <Flame className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${sourceInfo.color}`}>
            {sourceInfo.label}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-rose-dark font-medium">
            <TrendingUp className="w-2.5 h-2.5" />
            {trendScore}
          </span>
        </div>

        <p className="font-display font-semibold text-sm text-seoul-charcoal truncate group-hover:text-rose-dark transition-colors">
          {product.name_en}
        </p>
        <p className="text-[10px] text-seoul-soft">{product.brand_en}</p>

        <div className="flex items-center gap-3 text-[10px] text-seoul-soft">
          <span className="flex items-center gap-0.5">
            <MessageSquare className="w-2.5 h-2.5" />
            {formatMentions(mentionCount)} mentions
          </span>
          {sentimentScore !== null && (
            <span className={`font-medium ${sentimentScore >= 0.8 ? 'text-green-600' : sentimentScore >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
              {Math.round(sentimentScore * 100)}% positive
            </span>
          )}
          <span>{getDaysAgo(trendingSince)}</span>
        </div>
      </div>

      {/* Price + rating */}
      <div className="flex flex-col items-end justify-center flex-shrink-0 gap-1">
        {product.price_usd && (
          <span className="font-display font-bold text-sm text-seoul-charcoal">
            ${Number(product.price_usd).toFixed(0)}
          </span>
        )}
        {product.rating_avg && (
          <span className="flex items-center gap-0.5 text-[10px] text-seoul-soft">
            <Star className="w-2.5 h-2.5 fill-rose-gold text-rose-gold" />
            {Number(product.rating_avg).toFixed(1)}
          </span>
        )}
      </div>
    </Link>
  )
}
