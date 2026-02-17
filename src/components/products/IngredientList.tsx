'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, Beaker, Shield } from 'lucide-react'

interface IngredientData {
  position: number
  concentration_pct: number | null
  ingredient: {
    id: string
    name_inci: string
    name_en: string | null
    name_ko: string | null
    function: string
    description: string
    safety_rating: number
    comedogenic_rating: number
    is_fragrance: boolean
    is_active: boolean
    common_concerns: string[]
  }
}

interface IngredientListProps {
  ingredients: IngredientData[]
}

function SafetyBadge({ rating }: { rating: number }) {
  const config = rating >= 4
    ? { color: 'bg-green-100 text-green-700', label: 'Safe' }
    : rating >= 3
    ? { color: 'bg-yellow-100 text-yellow-700', label: 'Moderate' }
    : { color: 'bg-red-100 text-red-700', label: 'Caution' }

  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.color}`}>
      <Shield className="w-2.5 h-2.5" />
      {config.label}
    </span>
  )
}

function ComedogenicBadge({ rating }: { rating: number }) {
  if (rating <= 1) return null
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">
      Pore risk: {rating}/5
    </span>
  )
}

export default function IngredientList({ ingredients }: IngredientListProps) {
  const [expanded, setExpanded] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (ingredients.length === 0) {
    return (
      <div className="glass-card p-4 text-center">
        <Beaker className="w-6 h-6 text-seoul-soft/40 mx-auto mb-2" />
        <p className="text-sm text-seoul-soft">No ingredient data available yet.</p>
        <p className="text-xs text-seoul-soft/60 mt-1">Scan this product to analyze ingredients.</p>
      </div>
    )
  }

  const displayIngredients = expanded ? ingredients : ingredients.slice(0, 5)
  const hasMore = ingredients.length > 5

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-seoul-charcoal">
          Key Ingredients ({ingredients.length})
        </h3>
      </div>

      <div className="flex flex-col gap-1.5">
        {displayIngredients.map((item) => {
          const ing = item.ingredient
          const isSelected = selectedId === ing.id

          return (
            <button
              key={ing.id}
              onClick={() => setSelectedId(isSelected ? null : ing.id)}
              className="glass-card p-3 text-left hover:shadow-glass-lg transition-all duration-200 w-full"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-seoul-pearl text-[10px] font-bold text-seoul-soft flex-shrink-0">
                      {item.position}
                    </span>
                    <p className="font-medium text-sm text-seoul-charcoal truncate">
                      {ing.name_en || ing.name_inci}
                    </p>
                    {ing.is_active && (
                      <span className="badge-pink text-[9px] px-1.5 py-0.5 flex-shrink-0">Active</span>
                    )}
                    {ing.is_fragrance && (
                      <span className="flex items-center gap-0.5 text-[9px] text-amber-600 flex-shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Fragrance
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-seoul-soft mt-0.5 ml-7">
                    {ing.name_inci}
                    {item.concentration_pct && (
                      <span className="text-rose-gold font-medium ml-1">
                        ({item.concentration_pct}%)
                      </span>
                    )}
                  </p>
                </div>
                <SafetyBadge rating={ing.safety_rating} />
              </div>

              {/* Expanded detail */}
              {isSelected && (
                <div className="mt-3 ml-7 flex flex-col gap-2 animate-fade-in">
                  <p className="text-xs text-seoul-soft leading-relaxed">{ing.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="badge-blue text-[10px]">{ing.function}</span>
                    <ComedogenicBadge rating={ing.comedogenic_rating} />
                  </div>
                  {ing.common_concerns && ing.common_concerns.length > 0 && (
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700">
                        {ing.common_concerns.join(', ')}
                      </p>
                    </div>
                  )}
                  {ing.name_ko && (
                    <p className="text-[11px] text-seoul-soft">Korean: {ing.name_ko}</p>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 py-2 text-xs font-medium text-rose-gold hover:text-rose-dark transition-colors duration-200"
        >
          {expanded ? (
            <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>Show all {ingredients.length} ingredients <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      )}
    </div>
  )
}
