'use client'

import Link from 'next/link'
import { Star, Shield, Package, Droplets, Sun, Sparkles } from 'lucide-react'
import type { Product } from '@/types/database'

interface SunscreenCardProps {
  product: Product
}

const finishLabels: Record<string, string> = {
  matte: 'Matte',
  dewy: 'Dewy',
  natural: 'Natural',
  satin: 'Satin',
}

const typeLabels: Record<string, string> = {
  chemical: 'Chemical',
  physical: 'Physical',
  hybrid: 'Hybrid',
}

const whiteCastLabels: Record<string, string> = {
  none: 'No white cast',
  minimal: 'Minimal cast',
  moderate: 'Moderate cast',
  heavy: 'Heavy cast',
}

export default function SunscreenCard({ product }: SunscreenCardProps) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="glass-card p-4 flex flex-col gap-3 transition-all duration-300 group"
    >
      {/* Top row: image + info + price */}
      <div className="flex gap-3">
        {/* Product image */}
        <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name_en}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <Sun className="w-6 h-6 text-gold" strokeWidth={1.5} />
          )}
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-white truncate group-hover:text-gold transition-colors duration-200">
            {product.name_en}
          </p>
          <p className="text-xs text-white/40">{product.brand_en}</p>

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
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
        <div className="flex flex-col items-end justify-center flex-shrink-0">
          {product.price_usd && (
            <span className="font-display font-bold text-sm text-white">
              ${Number(product.price_usd).toFixed(0)}
            </span>
          )}
          {product.volume_display && (
            <span className="text-[10px] text-white/40">{product.volume_display}</span>
          )}
        </div>
      </div>

      {/* Sunscreen-specific badges */}
      <div className="flex flex-wrap gap-1.5">
        {product.spf_rating && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20">
            SPF {product.spf_rating}
          </span>
        )}
        {product.pa_rating && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/20">
            {product.pa_rating}
          </span>
        )}
        {product.sunscreen_type && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/50">
            {typeLabels[product.sunscreen_type]}
          </span>
        )}
        {product.finish && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/50">
            <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
            {finishLabels[product.finish]}
          </span>
        )}
        {product.white_cast && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
            product.white_cast === 'none'
              ? 'bg-emerald-500/15 text-emerald-300'
              : product.white_cast === 'minimal'
                ? 'bg-yellow-500/15 text-yellow-300'
                : 'bg-white/5 text-white/50'
          }`}>
            {whiteCastLabels[product.white_cast]}
          </span>
        )}
        {product.water_resistant && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/15 text-cyan-300">
            <Droplets className="w-2.5 h-2.5 inline mr-0.5" />
            Water resistant
          </span>
        )}
        {product.under_makeup && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-pink-500/15 text-pink-300">
            <Package className="w-2.5 h-2.5 inline mr-0.5" />
            Under makeup
          </span>
        )}
      </div>
    </Link>
  )
}
