'use client'

import Link from 'next/link'
import {
  Package,
  Droplet,
  Sparkles,
  FlaskConical,
  Sun,
  Layers,
  Eye,
  Smile,
  Wind,
  Zap,
  Snowflake,
  Bandage,
  ShowerHead,
} from 'lucide-react'
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

/**
 * v10.8.19 (Bailey, "should still put something there other than those boxes"):
 * category-aware placeholders for null-image / null-product entries (devices,
 * actions, custom-entry products). Each category gets a meaningful lucide icon
 * over a subtle tinted background so the card reads as intentional — "this is
 * a device" or "this is a cleansing step" — instead of "this looks broken."
 *
 * Falls back to a generic Package icon when category is null/unknown. The
 * tinted-background approach mirrors the ribbon-color palette so cards keep
 * visual coherence with the rest of the Library.
 */
function CategoryPlaceholder({ category, name }: { category: string | null; name: string }) {
  // Heuristic for null-category items: detect from name text.
  // Routine custom steps come through with category set (v10.3.7 inferCategoryFromNotes),
  // but defense-in-depth lets us still render the right icon if a caller forgets.
  const lowerName = (name || '').toLowerCase()
  const inferred =
    category ??
    (lowerName.includes('led mask') || lowerName.includes('red light') || lowerName.includes('blue light')
      ? 'device'
      : lowerName.includes('ice roller') || lowerName.includes('cold spoon') || lowerName.includes('gua sha')
        ? 'device'
        : lowerName.includes('shower') || lowerName.includes('rinse') || lowerName.includes('cleanse')
          ? 'cleanser'
          : null)

  const config = (() => {
    switch (inferred) {
      case 'cleanser':       return { Icon: ShowerHead,    bg: 'bg-sky-500/10',     ring: 'ring-sky-400/20',     fg: 'text-sky-300' }
      case 'toner':          return { Icon: Droplet,       bg: 'bg-cyan-500/10',    ring: 'ring-cyan-400/20',    fg: 'text-cyan-300' }
      case 'essence':        return { Icon: Sparkles,      bg: 'bg-blue-500/10',    ring: 'ring-blue-400/20',    fg: 'text-blue-300' }
      case 'serum':          return { Icon: FlaskConical,  bg: 'bg-violet-500/10',  ring: 'ring-violet-400/20',  fg: 'text-violet-300' }
      case 'ampoule':        return { Icon: FlaskConical,  bg: 'bg-fuchsia-500/10', ring: 'ring-fuchsia-400/20', fg: 'text-fuchsia-300' }
      case 'moisturizer':    return { Icon: Layers,        bg: 'bg-emerald-500/10', ring: 'ring-emerald-400/20', fg: 'text-emerald-300' }
      case 'sunscreen':      return { Icon: Sun,           bg: 'bg-amber-500/10',   ring: 'ring-amber-400/20',   fg: 'text-amber-300' }
      case 'mask':           return { Icon: Layers,        bg: 'bg-rose-500/10',    ring: 'ring-rose-400/20',    fg: 'text-rose-300' }
      case 'eye_care':       return { Icon: Eye,           bg: 'bg-indigo-500/10',  ring: 'ring-indigo-400/20',  fg: 'text-indigo-300' }
      case 'lip_care':       return { Icon: Smile,         bg: 'bg-pink-500/10',    ring: 'ring-pink-400/20',    fg: 'text-pink-300' }
      case 'exfoliator':     return { Icon: Sparkles,      bg: 'bg-orange-500/10',  ring: 'ring-orange-400/20',  fg: 'text-orange-300' }
      case 'oil':            return { Icon: Droplet,       bg: 'bg-yellow-500/10',  ring: 'ring-yellow-400/20',  fg: 'text-yellow-300' }
      case 'mist':           return { Icon: Wind,          bg: 'bg-teal-500/10',    ring: 'ring-teal-400/20',    fg: 'text-teal-300' }
      case 'spot_treatment': return { Icon: Bandage,       bg: 'bg-red-500/10',     ring: 'ring-red-400/20',     fg: 'text-red-300' }
      case 'device':
        // Distinguish LED mask (Zap) from ice roller (Snowflake) when possible.
        if (lowerName.includes('ice') || lowerName.includes('cold') || lowerName.includes('cool')) {
          return { Icon: Snowflake, bg: 'bg-sky-500/10', ring: 'ring-sky-400/20', fg: 'text-sky-300' }
        }
        return { Icon: Zap, bg: 'bg-purple-500/10', ring: 'ring-purple-400/20', fg: 'text-purple-300' }
      default:
        return { Icon: Package, bg: 'bg-white/5', ring: 'ring-white/10', fg: 'text-white/30' }
    }
  })()

  const { Icon, bg, ring, fg } = config
  return (
    <div className={`w-full h-full flex items-center justify-center ${bg} ring-1 ${ring}`}>
      <Icon className={`w-7 h-7 ${fg}`} strokeWidth={1.5} />
    </div>
  )
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
      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
        {imageUrl ? (
          <LazyImage
            src={imageUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            fallback={<CategoryPlaceholder category={category} name={displayName} />}
          />
        ) : (
          <CategoryPlaceholder category={category} name={displayName} />
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
