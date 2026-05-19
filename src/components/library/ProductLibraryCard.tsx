'use client'

import Link from 'next/link'
import { Package } from 'lucide-react'
import LazyImage from '@/components/ui/LazyImage'

export interface LibraryCardProps {
  /** Optional product ID for navigation. Null = custom entry (device, action, unmatched). */
  productId: string | null
  displayName: string
  displayBrand: string | null
  imageUrl: string | null
  category: string | null
  /**
   * One-line metadata line shown beneath the name/brand block.
   * Examples: "Tagged Holy Grail · Feb 24", "Expires in 12 days", "In your routine".
   */
  metadata?: string | null
  /** Optional ribbon-style label rendered on top-right (e.g. "Gap", "Urgent"). */
  ribbonLabel?: string | null
  ribbonTone?: 'rose' | 'amber' | 'emerald' | 'sky' | 'gray'
  /**
   * Optional inline action area rendered at the bottom of the card (e.g. "Mark as owned",
   * "Remove"). Caller controls behavior; card only provides the layout slot.
   */
  actionSlot?: React.ReactNode
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
  device: 'Device',
}

const ribbonStyles: Record<NonNullable<LibraryCardProps['ribbonTone']>, string> = {
  rose: 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30',
  amber: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30',
  emerald: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30',
  sky: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30',
  gray: 'bg-white/10 text-white/70 ring-1 ring-white/20',
}

/**
 * Reusable card used by every Library section. Renders a product (or a custom
 * non-product entry like a device step) with consistent visual rhythm. Wraps in
 * a Link only when productId is present; null-product entries render as plain
 * divs (no destination to navigate to).
 *
 * The Library never decorates a card with recommendation language — metadata
 * is observational (dates, day counts, ownership status). Yuri is the sole
 * recommender.
 */
export default function ProductLibraryCard({
  productId,
  displayName,
  displayBrand,
  imageUrl,
  category,
  metadata,
  ribbonLabel,
  ribbonTone = 'gray',
  actionSlot,
}: LibraryCardProps) {
  const categoryLabel = category ? categoryLabels[category] || category : null

  const inner = (
    <>
      {ribbonLabel && (
        <span
          className={`absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${ribbonStyles[ribbonTone]}`}
        >
          {ribbonLabel}
        </span>
      )}
      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center">
        {imageUrl ? (
          <LazyImage
            src={imageUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            fallback={<Package className="w-7 h-7 text-white/30" />}
          />
        ) : (
          <Package className="w-7 h-7 text-white/30" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {displayBrand && (
          <p className="text-xs text-white/60 truncate">{displayBrand}</p>
        )}
        <p className="text-sm font-medium text-white truncate">{displayName}</p>
        {categoryLabel && (
          <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-white/50">
            {categoryLabel}
          </span>
        )}
        {metadata && <p className="text-xs text-white/60 mt-1 truncate">{metadata}</p>}
        {actionSlot && <div className="mt-2">{actionSlot}</div>}
      </div>
    </>
  )

  const cardClass =
    'glass-card p-3 flex gap-3 transition-all duration-300 group relative items-start'

  if (productId) {
    return (
      <Link href={`/products/${productId}`} className={`${cardClass} hover:scale-[1.01]`}>
        {inner}
      </Link>
    )
  }

  return <div className={cardClass}>{inner}</div>
}
