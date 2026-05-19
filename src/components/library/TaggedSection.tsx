'use client'

import { Heart, AlertTriangle, X } from 'lucide-react'
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
  onClearReaction: (productId: string, name: string) => void
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
  onClearReaction,
}: {
  title: string
  icon: React.ReactNode
  accent: string
  emptyHint: string
  items: TagEntry[]
  onClearReaction: (productId: string, name: string) => void
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
                actionSlot={
                  entry.product_id ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onClearReaction(entry.product_id!, entry.display_name)
                      }}
                      aria-label="Untag"
                      title="Clear this tag"
                      className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/80 transition"
                    >
                      <X className="w-3 h-3" />
                      Untag
                    </button>
                  ) : null
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TaggedSection({ holyGrail, brokeMeOut, onClearReaction }: Props) {
  return (
    <section id="section-tagged" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Tagged</h2>
        <p className="text-sm text-white/60 mt-0.5">
          What you&rsquo;ve loved and what hasn&rsquo;t worked. Tag from the Owned section above; untag any time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Column
          title="Holy Grail"
          icon={<Heart className="w-4 h-4" fill="currentColor" />}
          accent="text-emerald-300"
          emptyHint="No Holy Grails tagged yet — tag a product you love from the Owned section above."
          items={holyGrail}
          onClearReaction={onClearReaction}
        />
        <Column
          title="Broke Me Out"
          icon={<AlertTriangle className="w-4 h-4" />}
          accent="text-rose-300"
          emptyHint="No reactions logged. Tag from the Owned section above."
          items={brokeMeOut}
          onClearReaction={onClearReaction}
        />
      </div>
    </section>
  )
}
