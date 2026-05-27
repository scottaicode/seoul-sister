'use client'

import Link from 'next/link'
import { Clock, ArrowUpRight } from 'lucide-react'
import ProductLibraryCard from './ProductLibraryCard'

export interface ExpiringItem {
  id: string
  product_id: string | null
  display_name: string
  display_brand: string | null
  image_url: string | null
  category: string | null
  opened_date: string | null
  expiry_date: string | null
  days_until_expiry: number | null
  bucket: 'urgent' | 'soon' | 'later'
}

interface Props {
  items: ExpiringItem[]
  total: number
}

function bucketCopy(item: ExpiringItem): { label: string; tone: 'rose' | 'amber' | 'emerald' | 'gray' } {
  if (item.days_until_expiry === null) {
    return { label: 'No date set', tone: 'gray' }
  }
  const d = item.days_until_expiry
  if (d < 0) return { label: `Expired ${Math.abs(d)}d ago`, tone: 'rose' }
  if (d < 14) return { label: `${d}d left`, tone: 'rose' }
  if (d <= 30) return { label: `${d}d left`, tone: 'amber' }
  return { label: `${d}d left`, tone: 'emerald' }
}

export default function ExpiringSection({ items, total }: Props) {
  return (
    <section id="section-expiring" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-300" />
            Expiring
          </h2>
          <p className="text-sm text-white/60 mt-0.5">
            {total === 0
              ? 'No products tracked for expiration yet.'
              : `Top ${items.length} of ${total} tracked product${total === 1 ? '' : 's'}, soonest first.`}
          </p>
        </div>
        {total > items.length && (
          <Link
            href="/tracking"
            className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition"
          >
            View all
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-white/70">
            Add expiration tracking from any product page or the{' '}
            <Link href="/tracking" className="text-rose-300 underline underline-offset-2">
              tracking dashboard
            </Link>
            .
          </p>
        </div>
      ) : (
        // v10.8.16: no 2-up at sm (matches the v10.8.12 Owned/Saved fix — the
        // same ProductLibraryCard crowds at sm:grid-cols-2). These cards are
        // sparse (no action buttons), so 2-up on genuinely wide screens is fine.
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((item) => {
            const { label, tone } = bucketCopy(item)
            return (
              <ProductLibraryCard
                key={item.id}
                productId={item.product_id}
                displayName={item.display_name}
                displayBrand={item.display_brand}
                imageUrl={item.image_url}
                category={item.category}
                ribbonLabel={label}
                ribbonTone={tone}
                metadata={item.expiry_date ? `Expires ${item.expiry_date}` : null}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
