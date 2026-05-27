'use client'

import { Plus, X, Heart, AlertTriangle } from 'lucide-react'
import ProductLibraryCard from './ProductLibraryCard'

export interface OwnedItem {
  id: string
  product_id: string | null
  display_name: string
  display_brand: string | null
  image_url: string | null
  category: string | null
  notes: string | null
  learned_from: string | null
  created_at: string
}

export type ReactionType = 'holy_grail' | 'broke_me_out'

interface Props {
  items: OwnedItem[]
  /** Map of product_id → current reaction tag (if any). Null product_ids never have reactions. */
  reactions: Map<string, ReactionType>
  onAdd: () => void
  onRemove: (id: string, name: string) => void
  /** Toggle a reaction on a product. If current === new reaction, clears it; otherwise sets it. */
  onToggleReaction: (productId: string, name: string, reaction: ReactionType, currentReaction: ReactionType | null) => void
}

export default function OwnedSection({ items, reactions, onAdd, onRemove, onToggleReaction }: Props) {
  return (
    <section id="section-owned" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Owned</h2>
          <p className="text-sm text-white/60 mt-0.5">
            {items.length === 0
              ? 'Your collection is empty.'
              : `${items.length} product${items.length === 1 ? '' : 's'} in your collection`}
          </p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-sm font-medium text-white ring-1 ring-white/15 transition"
        >
          <Plus className="w-4 h-4" />
          Add product
        </button>
      </div>

      {items.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-white/70">Add a product, or{' '}
            <a href="/scan" className="text-rose-300 underline underline-offset-2">scan one with your camera</a>.
          </p>
        </div>
      ) : (
        // v10.8.12 (Bailey, "still squished together"): single column. These
        // cards are information-dense (brand + name + category + notes + three
        // action buttons), so the old sm:grid-cols-2 cramped them on every
        // screen wider than mobile. One roomy column reads cleanly.
        <div className="space-y-3">
          {items.map((item) => {
            const currentReaction = item.product_id ? reactions.get(item.product_id) ?? null : null
            return (
              <ProductLibraryCard
                key={item.id}
                productId={item.product_id}
                displayName={item.display_name}
                displayBrand={item.display_brand}
                imageUrl={item.image_url}
                category={item.category}
                metadata={item.notes}
                actionSlot={
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Reaction buttons — disabled for custom (null product_id) entries
                        because reactions are keyed by product_id in ss_user_product_reactions. */}
                    {item.product_id && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onToggleReaction(item.product_id!, item.display_name, 'holy_grail', currentReaction)
                          }}
                          aria-label={currentReaction === 'holy_grail' ? 'Clear Holy Grail tag' : 'Tag as Holy Grail'}
                          title={currentReaction === 'holy_grail' ? 'Clear Holy Grail tag' : 'Tag as Holy Grail'}
                          className={`inline-flex items-center gap-1 text-[11px] transition ${
                            currentReaction === 'holy_grail'
                              ? 'text-emerald-300 hover:text-emerald-200'
                              : 'text-white/40 hover:text-emerald-300'
                          }`}
                        >
                          <Heart
                            className="w-3 h-3"
                            fill={currentReaction === 'holy_grail' ? 'currentColor' : 'none'}
                          />
                          Holy Grail
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onToggleReaction(item.product_id!, item.display_name, 'broke_me_out', currentReaction)
                          }}
                          aria-label={currentReaction === 'broke_me_out' ? 'Clear Broke Me Out tag' : 'Tag as Broke Me Out'}
                          title={currentReaction === 'broke_me_out' ? 'Clear Broke Me Out tag' : 'Tag as Broke Me Out'}
                          className={`inline-flex items-center gap-1 text-[11px] transition ${
                            currentReaction === 'broke_me_out'
                              ? 'text-rose-300 hover:text-rose-200'
                              : 'text-white/40 hover:text-rose-300'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Broke me out
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onRemove(item.id, item.display_name)
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-rose-300 transition ml-auto"
                    >
                      <X className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                }
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
