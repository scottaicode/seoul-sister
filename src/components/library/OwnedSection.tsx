'use client'

import { Plus, X } from 'lucide-react'
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

interface Props {
  items: OwnedItem[]
  onAdd: () => void
  onRemove: (id: string, name: string) => void
}

export default function OwnedSection({ items, onAdd, onRemove }: Props) {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <ProductLibraryCard
              key={item.id}
              productId={item.product_id}
              displayName={item.display_name}
              displayBrand={item.display_brand}
              imageUrl={item.image_url}
              category={item.category}
              metadata={item.notes}
              actionSlot={
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onRemove(item.id, item.display_name)
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-rose-300 transition"
                >
                  <X className="w-3 h-3" />
                  Remove
                </button>
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
