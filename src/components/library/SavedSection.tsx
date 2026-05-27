'use client'

import ProductLibraryCard from './ProductLibraryCard'

export interface SavedItem {
  id: string
  source: 'wishlist' | 'scan'
  product_id: string | null
  display_name: string
  display_brand: string | null
  image_url: string | null
  category: string | null
  created_at: string
}

interface Props {
  items: SavedItem[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SavedSection({ items }: Props) {
  return (
    <section id="section-saved" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Saved</h2>
        <p className="text-sm text-white/60 mt-0.5">
          {items.length === 0
            ? 'Nothing saved yet.'
            : 'Products you wishlisted or scanned but haven’t added to your collection.'}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-white/70">
            Scan a product or tap the heart on any product page to save it here.
          </p>
        </div>
      ) : (
        // v10.8.12 (Bailey): single column, matching Owned, for consistent rhythm.
        <div className="space-y-3">
          {items.map((item) => (
            <ProductLibraryCard
              key={item.id}
              productId={item.product_id}
              displayName={item.display_name}
              displayBrand={item.display_brand}
              imageUrl={item.image_url}
              category={item.category}
              ribbonLabel={item.source === 'wishlist' ? 'Wishlist' : 'Scanned'}
              ribbonTone={item.source === 'wishlist' ? 'sky' : 'gray'}
              metadata={formatDate(item.created_at)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
