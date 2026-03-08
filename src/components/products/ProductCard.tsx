'use client'

import Link from 'next/link'
import { Star, Shield, Package, TrendingUp, Sparkles } from 'lucide-react'
import type { Product } from '@/types/database'

export interface TrendingInfo {
  source: string
  trend_score: number
  gap_score: number
}

interface ProductCardProps {
  product: Product
  trendingInfo?: TrendingInfo
  /** Base path for product links (default: '/products') */
  basePath?: string
}

const categoryLabels: Record<string, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  essence: 'Essence',
  serum: 'Serum',
  ampoule: 'Ampoule',
  moisturizer: 'Moisturizer',
  sunscreen: 'Sunscreen',
  mask: 'Mask',
  eye_care: 'Eye Care',
  lip_care: 'Lip Care',
  exfoliator: 'Exfoliator',
  oil: 'Oil',
  mist: 'Mist',
  spot_treatment: 'Spot Treatment',
}

function getTrendingBadge(info: TrendingInfo): { label: string; className: string } | null {
  if (info.gap_score > 50) {
    return {
      label: 'Emerging',
      className: 'bg-purple-500/20 text-purple-300',
    }
  }
  if (info.source === 'olive_young' || info.source === 'olive_young_bestseller') {
    return {
      label: 'Trending in Korea',
      className: 'bg-rose-500/20 text-rose-300',
    }
  }
  if (info.source === 'reddit') {
    return {
      label: 'Trending on Reddit',
      className: 'bg-orange-500/20 text-orange-300',
    }
  }
  if (info.trend_score > 0) {
    return {
      label: 'Trending',
      className: 'bg-amber-500/20 text-amber-300',
    }
  }
  return null
}

export default function ProductCard({ product, trendingInfo, basePath = '/products' }: ProductCardProps) {
  const badge = trendingInfo ? getTrendingBadge(trendingInfo) : null

  return (
    <Link
      href={`${basePath}/${product.id}`}
      className="glass-card p-4 flex gap-3 transition-all duration-300 group relative"
    >
      {/* Trending badge */}
      {badge && (
        <span className={`absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${badge.className}`}>
          {badge.label === 'Emerging' ? (
            <Sparkles className="w-2.5 h-2.5" />
          ) : (
            <TrendingUp className="w-2.5 h-2.5" />
          )}
          {badge.label}
        </span>
      )}

      {/* Product image placeholder */}
      <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name_en}
            className="w-full h-full object-cover rounded-xl"
          />
        ) : (
          <Package className="w-6 h-6 text-gold" strokeWidth={1.5} />
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-white truncate group-hover:text-gold transition-colors duration-200">
          {product.name_en}
        </p>
        <p className="text-xs text-white/40">{product.brand_en}</p>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="badge-blue text-[10px]">
            {categoryLabels[product.category] ?? product.category}
          </span>

          {product.rating_avg && (
            <span className="flex items-center gap-0.5 text-[10px] text-white/40">
              <Star className="w-2.5 h-2.5 fill-gold text-gold" />
              {Number(product.rating_avg).toFixed(1)}
              {product.review_count > 0 && (
                <span className="text-white/30">({product.review_count})</span>
              )}
            </span>
          )}

          {product.is_verified && (
            <span className="flex items-center gap-0.5 text-[10px] text-green-600">
              <Shield className="w-2.5 h-2.5" />
              Verified
            </span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className={`flex flex-col items-end justify-center flex-shrink-0 ${badge ? 'mt-4' : ''}`}>
        {product.price_usd && (
          <span className="font-display font-bold text-sm text-white">
            ${Number(product.price_usd).toFixed(0)}
          </span>
        )}
        {product.volume_display && (
          <span className="text-[10px] text-white/40">{product.volume_display}</span>
        )}
      </div>
    </Link>
  )
}
