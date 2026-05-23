'use client'

/**
 * v10.8.0 Path B — Wraps ProductCard with curation-specific UI:
 *   - Per-card "Ask Yuri about this" inline CTA (pure HTML <Link>, $0 cost)
 *   - Optional SkipReasoning expander (lazy-fetched, Opus 4.7 reasoning)
 *
 * Used by /browse for both `fits` and `skipped` lists. Skip reasoning only
 * renders when `showSkipReasoning` is true (passed by the skip toggle expand).
 */

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import ProductCard, { type TrendingInfo } from '@/components/products/ProductCard'
import SkipReasoning, { type MatchedItemDTO } from '@/components/products/SkipReasoning'
import type { Product } from '@/types/database'

interface ActivePhaseInfo {
  phase_number: number
  name: string
}

interface CuratedProductCardProps {
  product: Product & {
    skip_preview?: {
      matched_items: MatchedItemDTO[]
    }
  }
  trendingInfo?: TrendingInfo
  showSkipReasoning?: boolean
  activePhase: ActivePhaseInfo | null
  priority?: boolean
}

function buildYuriAskPrefill(product: Product, activePhase: ActivePhaseInfo | null): string {
  const lines: string[] = [
    `I'm looking at ${product.brand_en} ${product.name_en} on the curated browse page.`,
  ]
  if (activePhase) {
    lines.push(`I'm on Phase ${activePhase.phase_number} (${activePhase.name}) right now.`)
  }
  lines.push('Given everything you know about my skin and where I am in my treatment, would this be a good fit or should I skip it?')
  return lines.join(' ')
}

export default function CuratedProductCard({
  product,
  trendingInfo,
  showSkipReasoning = false,
  activePhase,
  priority = false,
}: CuratedProductCardProps) {
  const askHref = `/yuri?ask=${encodeURIComponent(buildYuriAskPrefill(product, activePhase))}`
  const matchedItems = product.skip_preview?.matched_items || []

  return (
    <div className="flex flex-col gap-2">
      <ProductCard
        product={product}
        trendingInfo={trendingInfo}
        basePath="/browse"
        priority={priority}
      />

      {/* Inline Ask Yuri CTA — pure static link, no AI cost.
          Only fires Opus if subscriber actually clicks through to /yuri. */}
      <div className="flex justify-end">
        <Link
          href={askHref}
          className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-rose-200 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          Ask Yuri about this
        </Link>
      </div>

      {/* Skip reasoning expander — only on skipped cards when toggle is open */}
      {showSkipReasoning && (
        <SkipReasoning
          productId={product.id}
          initialMatchedItems={matchedItems}
        />
      )}
    </div>
  )
}
