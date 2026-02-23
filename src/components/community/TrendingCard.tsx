'use client'

import Link from 'next/link'
import { TrendingUp, Package, Star, Flame, ArrowUp, ArrowDown, Minus, Sparkles } from 'lucide-react'
import type { Product } from '@/types/database'

interface TrendingCardProps {
  product: Product | null
  source: string
  trendScore: number
  mentionCount: number
  sentimentScore: number | null
  trendingSince: string
  // Phase 10.1: New fields for external trend data
  sourceProductName?: string | null
  sourceProductBrand?: string | null
  sourceUrl?: string | null
  rankPosition?: number | null
  rankChange?: number | null
  daysOnList?: number | null
  // Phase 10.3: Gap score (Korea vs US awareness gap)
  gapScore?: number | null
  // Phase 12.7: Personalized cohort label
  cohortLabel?: string | null
  cohortScore?: number | null
}

const sourceLabels: Record<string, { label: string; color: string }> = {
  olive_young: { label: 'Olive Young', color: 'bg-green-100 text-green-700' },
  tiktok: { label: 'TikTok', color: 'bg-black text-white' },
  reddit: { label: 'Reddit', color: 'bg-orange-100 text-orange-700' },
  instagram: { label: 'Instagram', color: 'bg-purple-100 text-purple-700' },
  korean_market: { label: 'Seoul', color: 'bg-gold/10 text-gold' },
  community: { label: 'Community', color: 'bg-sky-100 text-sky-700' },
}

function getDaysAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function RankBadge({ rank }: { rank: number }) {
  const bgColor = rank <= 3
    ? 'bg-gradient-to-br from-gold to-amber-600 text-white'
    : rank <= 10
    ? 'bg-white/10 text-gold'
    : 'bg-white/5 text-white/60'

  return (
    <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center font-display font-bold text-xs`}>
      {rank}
    </div>
  )
}

function RankChangeIndicator({ change, daysOnList }: { change: number | null; daysOnList: number | null }) {
  if (daysOnList !== null && daysOnList <= 1) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
        <Sparkles className="w-2.5 h-2.5" />
        NEW
      </span>
    )
  }

  if (change === null || change === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-white/30">
        <Minus className="w-2.5 h-2.5" />
      </span>
    )
  }

  if (change > 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-400">
        <ArrowUp className="w-2.5 h-2.5" />
        {change}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-0.5 text-[10px] font-medium text-rose-400">
      <ArrowDown className="w-2.5 h-2.5" />
      {Math.abs(change)}
    </span>
  )
}

export default function TrendingCard({
  product,
  source,
  trendScore,
  mentionCount,
  sentimentScore,
  trendingSince,
  sourceProductName,
  sourceProductBrand,
  sourceUrl,
  rankPosition,
  rankChange,
  daysOnList,
  gapScore,
  cohortLabel,
  cohortScore,
}: TrendingCardProps) {
  const sourceInfo = sourceLabels[source] ?? { label: source, color: 'bg-gray-100 text-gray-700' }
  const isOliveYoung = source === 'olive_young'
  const isReddit = source === 'reddit'
  const isEmerging = (gapScore ?? 0) > 50

  // Use product data if matched, fall back to source data
  const displayName = product?.name_en ?? sourceProductName ?? 'Unknown Product'
  const displayBrand = product?.brand_en ?? sourceProductBrand ?? ''
  const hasProductPage = product?.id != null

  // Link to product page if matched, otherwise to source URL
  const href = hasProductPage
    ? `/products/${product!.id}`
    : sourceUrl ?? '#'
  const isExternal = !hasProductPage && sourceUrl != null

  const CardContent = (
    <div className="glass-card p-4 flex gap-3 transition-all duration-300 group">
      {/* Rank badge (for ranked sources) or product image */}
      {isOliveYoung && rankPosition ? (
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <RankBadge rank={rankPosition} />
          <RankChangeIndicator change={rankChange ?? null} daysOnList={daysOnList ?? null} />
        </div>
      ) : (
        <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden relative">
          {product?.image_url ? (
            <img
              src={product.image_url}
              alt={displayName}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <Package className="w-6 h-6 text-gold/50" strokeWidth={1.5} />
          )}
          {trendScore >= 80 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
              <Flame className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${sourceInfo.color}`}>
            {sourceInfo.label}
          </span>
          {isEmerging && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
              <Sparkles className="w-2.5 h-2.5" />
              Emerging
            </span>
          )}
          <span className="flex items-center gap-0.5 text-[10px] text-gold font-medium">
            <TrendingUp className="w-2.5 h-2.5" />
            {trendScore}
          </span>
          {!hasProductPage && isOliveYoung && (
            <span className="text-[10px] text-white/20 italic">not in DB</span>
          )}
        </div>

        <p className="font-display font-semibold text-sm text-white truncate group-hover:text-gold transition-colors">
          {displayName}
        </p>
        <p className="text-[10px] text-white/40">{displayBrand}</p>

        {/* Cohort label — personalized skin-type effectiveness */}
        {cohortLabel && (
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
              (cohortScore ?? 0) >= 75
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : (cohortScore ?? 0) >= 60
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
            }`}>
              {cohortLabel}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 text-[10px] text-white/40">
          {isOliveYoung && daysOnList != null && (
            <span>{daysOnList}d on list</span>
          )}
          {isReddit && mentionCount > 0 && (
            <span>{mentionCount} mention{mentionCount !== 1 ? 's' : ''}</span>
          )}
          {sentimentScore !== null && sentimentScore !== 0.5 && (
            <span className={`font-medium ${sentimentScore >= 0.7 ? 'text-green-600' : sentimentScore >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
              {Math.round(sentimentScore * 100)}% positive
            </span>
          )}
          {isEmerging && (
            <span className="font-medium text-violet-400">
              Not yet trending in the US
            </span>
          )}
          <span>{getDaysAgo(trendingSince)}</span>
        </div>
      </div>

      {/* Price + rating */}
      <div className="flex flex-col items-end justify-center flex-shrink-0 gap-1">
        {(product?.price_usd || (isOliveYoung && product == null)) && (
          <span className="font-display font-bold text-sm text-white">
            {product?.price_usd
              ? `$${Number(product.price_usd).toFixed(0)}`
              : ''}
          </span>
        )}
        {product?.rating_avg && (
          <span className="flex items-center gap-0.5 text-[10px] text-white/40">
            <Star className="w-2.5 h-2.5 fill-gold text-gold" />
            {Number(product.rating_avg).toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {CardContent}
      </a>
    )
  }

  if (hasProductPage) {
    return (
      <Link href={href} className="block">
        {CardContent}
      </Link>
    )
  }

  return <div>{CardContent}</div>
}
