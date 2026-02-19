'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, X, Search, Droplets, Sparkles, ShieldCheck } from 'lucide-react'

interface IngredientOption {
  id: string
  name_inci: string
  name_en: string
  function: string
  is_active: boolean
  is_fragrance: boolean
  comedogenic_rating: number
  safety_rating: number
}

interface IngredientPickerProps {
  includeIngredients: string[]
  excludeIngredients: string[]
  fragranceFree: boolean
  comedogenicMax: number | null
  onIncludeChange: (ingredients: string[]) => void
  onExcludeChange: (ingredients: string[]) => void
  onFragranceFreeChange: (value: boolean) => void
  onComedogenicMaxChange: (value: number | null) => void
}

export default function IngredientPicker({
  includeIngredients,
  excludeIngredients,
  fragranceFree,
  comedogenicMax,
  onIncludeChange,
  onExcludeChange,
  onFragranceFreeChange,
  onComedogenicMaxChange,
}: IngredientPickerProps) {
  const [allIngredients, setAllIngredients] = useState<IngredientOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeMode, setActiveMode] = useState<'include' | 'exclude'>('include')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch all ingredients once on mount (small dataset ~30 rows)
  useEffect(() => {
    fetch('/api/ingredients/search')
      .then(res => res.json())
      .then(data => setAllIngredients(data.ingredients ?? []))
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = allIngredients.filter(ing => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return ing.name_en.toLowerCase().includes(q) || ing.name_inci.toLowerCase().includes(q)
  })

  // Exclude already-selected ingredients from dropdown
  const selectedNames = new Set([...includeIngredients, ...excludeIngredients].map(s => s.toLowerCase()))
  const available = filtered.filter(ing => !selectedNames.has(ing.name_en.toLowerCase()))

  function addIngredient(name: string) {
    if (activeMode === 'include') {
      onIncludeChange([...includeIngredients, name])
    } else {
      onExcludeChange([...excludeIngredients, name])
    }
    setSearchQuery('')
    setShowDropdown(false)
  }

  function removeInclude(name: string) {
    onIncludeChange(includeIngredients.filter(n => n !== name))
  }

  function removeExclude(name: string) {
    onExcludeChange(excludeIngredients.filter(n => n !== name))
  }

  const hasActiveFilters = includeIngredients.length > 0 || excludeIngredients.length > 0 || fragranceFree || comedogenicMax !== null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-white">Ingredients</p>

      {/* Shortcut buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onFragranceFreeChange(!fragranceFree)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
            fragranceFree
              ? 'bg-rose-500/30 text-rose-300 ring-1 ring-rose-500/40'
              : 'bg-white/5 text-white/40 hover:bg-white/10'
          }`}
        >
          <Droplets className="w-3 h-3" />
          Fragrance-free
        </button>
        <button
          onClick={() => onComedogenicMaxChange(comedogenicMax === 2 ? null : 2)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
            comedogenicMax === 2
              ? 'bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/40'
              : 'bg-white/5 text-white/40 hover:bg-white/10'
          }`}
        >
          <ShieldCheck className="w-3 h-3" />
          Low comedogenic
        </button>
        <button
          onClick={() => {
            // Sensitive skin: exclude common irritants
            const irritants = ['Alcohol Denat', 'Fragrance']
            const alreadySet = irritants.every(i => excludeIngredients.includes(i))
            if (alreadySet) {
              onExcludeChange(excludeIngredients.filter(n => !irritants.includes(n)))
              if (fragranceFree) onFragranceFreeChange(false)
            } else {
              const newExcludes = [...new Set([...excludeIngredients, ...irritants])]
              onExcludeChange(newExcludes)
              onFragranceFreeChange(true)
            }
          }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
            fragranceFree && excludeIngredients.includes('Alcohol Denat')
              ? 'bg-blue-500/30 text-blue-300 ring-1 ring-blue-500/40'
              : 'bg-white/5 text-white/40 hover:bg-white/10'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          Sensitive skin safe
        </button>
      </div>

      {/* Include/Exclude mode toggle + search */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setActiveMode('include')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            activeMode === 'include'
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-white/5 text-white/30 hover:bg-white/10'
          }`}
        >
          + Must contain
        </button>
        <button
          onClick={() => setActiveMode('exclude')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            activeMode === 'exclude'
              ? 'bg-rose-500/20 text-rose-300'
              : 'bg-white/5 text-white/30 hover:bg-white/10'
          }`}
        >
          - Must NOT contain
        </button>
      </div>

      {/* Search input with dropdown */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            ref={inputRef}
            type="text"
            placeholder={activeMode === 'include' ? 'Search ingredients to include...' : 'Search ingredients to exclude...'}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            className="glass-input w-full pl-8 pr-3 py-2 text-xs"
          />
        </div>

        {showDropdown && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 glass-card max-h-48 overflow-y-auto border border-white/10 rounded-xl shadow-lg">
            {available.length === 0 ? (
              <p className="px-3 py-2 text-xs text-white/30">
                {searchQuery ? 'No matching ingredients' : 'All ingredients selected'}
              </p>
            ) : (
              available.slice(0, 15).map(ing => (
                <button
                  key={ing.id}
                  onClick={() => addIngredient(ing.name_en)}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-xs text-white block truncate">{ing.name_en}</span>
                    <span className="text-[10px] text-white/30 block truncate">{ing.name_inci} &middot; {ing.function}</span>
                  </div>
                  <Plus className={`w-3.5 h-3.5 flex-shrink-0 ${activeMode === 'include' ? 'text-emerald-400' : 'text-rose-400'}`} />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected pills */}
      {includeIngredients.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-emerald-400/70 uppercase tracking-wider">Must contain</span>
          <div className="flex flex-wrap gap-1.5">
            {includeIngredients.map(name => (
              <span key={name} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
                {name}
                <button onClick={() => removeInclude(name)} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {excludeIngredients.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-rose-400/70 uppercase tracking-wider">Must NOT contain</span>
          <div className="flex flex-wrap gap-1.5">
            {excludeIngredients.map(name => (
              <span key={name} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30">
                {name}
                <button onClick={() => removeExclude(name)} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={() => {
            onIncludeChange([])
            onExcludeChange([])
            onFragranceFreeChange(false)
            onComedogenicMaxChange(null)
          }}
          className="text-[10px] text-white/30 hover:text-white/60 self-start transition-colors"
        >
          Clear ingredient filters
        </button>
      )}
    </div>
  )
}
