'use client'

import { Heart, AlertTriangle } from 'lucide-react'
import ProductLibraryCard from './ProductLibraryCard'

export interface TagEntry {
  id: string
  product_id: string | null
  display_name: string
  display_brand: string | null
  image_url: string | null
  category: string | null
  notes: string | null
  reaction_date: string
}

interface Props {
  holyGrail: TagEntry[]
  brokeMeOut: TagEntry[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Column({
  title,
  icon,
  accent,
  emptyHint,
  items,
}: {
  title: string
  icon: React.ReactNode
  accent: string
  emptyHint: string
  items: TagEntry[]
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={accent}>{icon}</span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-white/50">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-white/50 italic">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {items.map((entry) => {
            const meta = entry.notes
              ? `${formatDate(entry.reaction_date)} · ${entry.notes}`
              : `Tagged ${formatDate(entry.reaction_date)}`
            return (
              <ProductLibraryCard
                key={entry.id}
                productId={entry.product_id}
                displayName={entry.display_name}
                displayBrand={entry.display_brand}
                imageUrl={entry.image_url}
                category={entry.category}
                metadata={meta}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TaggedSection({ holyGrail, brokeMeOut }: Props) {
  return (
    <section id="section-tagged" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Tagged</h2>
        <p className="text-sm text-white/60 mt-0.5">
          What you’ve loved and what hasn’t worked.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Column
          title="Holy Grail"
          icon={<Heart className="w-4 h-4" fill="currentColor" />}
          accent="text-emerald-300"
          emptyHint="No Holy Grails tagged yet — tag a product you love from its detail page."
          items={holyGrail}
        />
        <Column
          title="Broke Me Out"
          icon={<AlertTriangle className="w-4 h-4" />}
          accent="text-rose-300"
          emptyHint="No reactions logged. Tag any product that didn’t work from its detail page."
          items={brokeMeOut}
        />
      </div>
    </section>
  )
}
