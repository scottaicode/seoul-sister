'use client'

import {
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
} from 'lucide-react'
import type { ShelfScanCollectionAnalysis, ShelfScanProduct } from '@/types/database'

interface CollectionStatsProps {
  analysis: ShelfScanCollectionAnalysis
  products: ShelfScanProduct[]
  matchedCount: number
}

export default function CollectionStats({
  analysis,
  products,
  matchedCount,
}: CollectionStatsProps) {
  // Category breakdown
  const categories = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1
    return acc
  }, {})

  const categoryEntries = Object.entries(categories).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card p-3 text-center">
          <Package className="w-4 h-4 text-gold mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{products.length}</p>
          <p className="text-[10px] text-white/40">Products</p>
        </div>
        <div className="glass-card p-3 text-center">
          <DollarSign className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">
            ${Math.round(analysis.total_estimated_value)}
          </p>
          <p className="text-[10px] text-white/40">Est. Value</p>
        </div>
        <div className="glass-card p-3 text-center">
          <Layers className="w-4 h-4 text-sky-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{categoryEntries.length}</p>
          <p className="text-[10px] text-white/40">Categories</p>
        </div>
      </div>

      {/* Category breakdown */}
      {categoryEntries.length > 0 && (
        <div className="glass-card p-4">
          <h4 className="font-display font-semibold text-xs text-white/60 mb-2">
            Category Breakdown
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {categoryEntries.map(([cat, count]) => (
              <span
                key={cat}
                className="text-[10px] text-white/70 bg-white/5 px-2 py-1 rounded-full"
              >
                {cat.replace('_', ' ')} ({count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing categories */}
      {analysis.missing_categories.length > 0 && (
        <div className="glass-card p-4 ring-1 ring-amber-400/20">
          <h4 className="font-display font-semibold text-xs text-amber-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Missing Categories
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missing_categories.map((cat) => (
              <span
                key={cat}
                className="text-[10px] text-amber-400/80 bg-amber-400/10 px-2 py-1 rounded-full"
              >
                {cat.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Redundant products */}
      {analysis.redundant_products.length > 0 && (
        <div className="glass-card p-4 ring-1 ring-rose-400/20">
          <h4 className="font-display font-semibold text-xs text-rose-400 mb-2 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Redundancies
          </h4>
          <ul className="space-y-1">
            {analysis.redundant_products.map((item, i) => (
              <li key={i} className="text-xs text-white/50">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ingredient overlap warnings */}
      {analysis.ingredient_overlap_warnings.length > 0 && (
        <div className="glass-card p-4 ring-1 ring-amber-400/10">
          <h4 className="font-display font-semibold text-xs text-amber-300 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Ingredient Overlap
          </h4>
          <ul className="space-y-1">
            {analysis.ingredient_overlap_warnings.map((warning, i) => (
              <li key={i} className="text-xs text-white/50">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Database match info */}
      <div className="glass-card p-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <p className="text-xs text-white/50">
          {matchedCount} of {products.length} products matched in Seoul Sister database
        </p>
      </div>
    </div>
  )
}
