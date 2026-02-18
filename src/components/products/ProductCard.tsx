'use client'

import Link from 'next/link'
import { Star, Shield, Package } from 'lucide-react'
import type { Product } from '@/types/database'

interface ProductCardProps {
  product: Product
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

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="glass-card p-4 flex gap-3 transition-all duration-300 group"
    >
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
    </Link>
  )
}
