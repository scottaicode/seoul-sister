'use client'

import Link from 'next/link'
import {
  CheckCircle2,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import type { ShelfScanProduct, ProductCategory } from '@/types/database'

const CATEGORY_LABELS: Record<string, string> = {
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

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-emerald-400'
  if (confidence >= 0.5) return 'text-amber-400'
  return 'text-white/40'
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High'
  if (confidence >= 0.5) return 'Medium'
  return 'Low'
}

interface CollectionGridProps {
  products: ShelfScanProduct[]
}

export default function CollectionGrid({ products }: CollectionGridProps) {
  if (products.length === 0) {
    return (
      <div className="glass-card p-4 text-center">
        <p className="text-sm text-white/40">No products identified in this photo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {products.map((product, idx) => (
        <div key={idx} className="glass-card p-3 flex items-start gap-3">
          {/* Index */}
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white/40">
            {idx + 1}
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display font-semibold text-sm text-white truncate">
                  {product.name}
                </p>
                <p className="text-xs text-white/40">
                  {product.brand}
                </p>
              </div>

              {/* Matched badge */}
              {product.matched_product_id ? (
                <Link
                  href={`/products/${product.matched_product_id}`}
                  className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full flex-shrink-0 hover:bg-emerald-400/20 transition-colors duration-200"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  In DB
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  <HelpCircle className="w-3 h-3" />
                  Unknown
                </span>
              )}
            </div>

            {/* Category + confidence */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-gold bg-gold/10 px-1.5 py-0.5 rounded-full">
                {CATEGORY_LABELS[product.category] || product.category}
              </span>
              <span className={`text-[10px] ${getConfidenceColor(product.confidence)}`}>
                {getConfidenceLabel(product.confidence)} confidence ({Math.round(product.confidence * 100)}%)
              </span>
            </div>

            {/* Position */}
            {product.position_in_image && (
              <p className="text-[10px] text-white/20 mt-1">
                {product.position_in_image}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
