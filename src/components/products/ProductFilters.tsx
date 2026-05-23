'use client'

/**
 * Product filters component.
 *
 * v10.8.0 Path B: the "For You" button and sort-row UI have been removed.
 * Browse is now curated by default (phase + decision_memory + allergens),
 * so an algorithmic ingredient-effectiveness sort would compete with Yuri's
 * authority. This is the sixth Yuri Sole Authority Principle compliance
 * step in the codebase. Component now surfaces: search, category, and
 * ingredient include/exclude — additive filters on top of curation.
 *
 * The `sortBy` and `onSortChange` props are retained for backward
 * compatibility but currently unused; sort is always 'curated' from /browse.
 */

import { Search, SlidersHorizontal, X } from 'lucide-react'
import IngredientPicker from '@/components/products/IngredientPicker'
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

interface ProductFiltersProps {
  query: string
  category: string
  sortBy: string
  showFilters: boolean
  includeIngredients: string[]
  excludeIngredients: string[]
  fragranceFree: boolean
  comedogenicMax: number | null
  isAuthenticated?: boolean
  onQueryChange: (query: string) => void
  onCategoryChange: (category: string) => void
  onSortChange: (sort: string) => void
  onToggleFilters: () => void
  onIncludeIngredientsChange: (ingredients: string[]) => void
  onExcludeIngredientsChange: (ingredients: string[]) => void
  onFragranceFreeChange: (value: boolean) => void
  onComedogenicMaxChange: (value: number | null) => void
}

export default function ProductFilters({
  query,
  category,
  showFilters,
  includeIngredients,
  excludeIngredients,
  fragranceFree,
  comedogenicMax,
  onQueryChange,
  onCategoryChange,
  onToggleFilters,
  onIncludeIngredientsChange,
  onExcludeIngredientsChange,
  onFragranceFreeChange,
  onComedogenicMaxChange,
}: ProductFiltersProps) {
  const hasIngredientFilters = includeIngredients.length > 0 || excludeIngredients.length > 0 || fragranceFree || comedogenicMax !== null

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
            showFilters || category || hasIngredientFilters
              ? 'bg-gold text-white'
              : 'bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {hasIngredientFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
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

          {/* Ingredient filters */}
          <IngredientPicker
            includeIngredients={includeIngredients}
            excludeIngredients={excludeIngredients}
            fragranceFree={fragranceFree}
            comedogenicMax={comedogenicMax}
            onIncludeChange={onIncludeIngredientsChange}
            onExcludeChange={onExcludeIngredientsChange}
            onFragranceFreeChange={onFragranceFreeChange}
            onComedogenicMaxChange={onComedogenicMaxChange}
          />
        </div>
      )}
    </div>
  )
}
