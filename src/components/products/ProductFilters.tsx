'use client'

import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { ProductCategory } from '@/types/database'

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'cleanser', label: 'Cleanser' },
  { value: 'toner', label: 'Toner' },
  { value: 'essence', label: 'Essence' },
  { value: 'serum', label: 'Serum' },
  { value: 'ampoule', label: 'Ampoule' },
  { value: 'moisturizer', label: 'Moisturizer' },
  { value: 'sunscreen', label: 'Sunscreen' },
  { value: 'mask', label: 'Mask' },
  { value: 'eye_care', label: 'Eye Care' },
  { value: 'lip_care', label: 'Lip Care' },
  { value: 'exfoliator', label: 'Exfoliator' },
  { value: 'oil', label: 'Oil' },
  { value: 'mist', label: 'Mist' },
  { value: 'spot_treatment', label: 'Spot Treatment' },
]

const SORT_OPTIONS = [
  { value: 'rating', label: 'Top Rated' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
] as const

interface ProductFiltersProps {
  query: string
  category: string
  sortBy: string
  showFilters: boolean
  onQueryChange: (query: string) => void
  onCategoryChange: (category: string) => void
  onSortChange: (sort: string) => void
  onToggleFilters: () => void
}

export default function ProductFilters({
  query,
  category,
  sortBy,
  showFilters,
  onQueryChange,
  onCategoryChange,
  onSortChange,
  onToggleFilters,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search products, brands..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="glass-input pl-9 pr-4 py-2.5 text-sm"
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={onToggleFilters}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            showFilters || category
              ? 'bg-gold text-white'
              : 'glass-card text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="glass-card p-4 flex flex-col gap-4 animate-slide-down">
          {/* Categories */}
          <div>
            <p className="text-xs font-medium text-white mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onCategoryChange('')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  !category
                    ? 'bg-gold text-white'
                    : 'bg-white/5 text-white/40 hover:bg-gold/10'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => onCategoryChange(cat.value === category ? '' : cat.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    category === cat.value
                      ? 'bg-gold text-white'
                      : 'bg-white/5 text-white/40 hover:bg-gold/10'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs font-medium text-white mb-2">Sort by</p>
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    sortBy === opt.value
                      ? 'bg-glass-500 text-white'
                      : 'bg-white/5 text-white/40 hover:bg-glass-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
