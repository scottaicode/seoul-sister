'use client'

import { Sun, X } from 'lucide-react'
import type { PaRating, SunscreenType, WhiteCast, SunscreenFinish, SunscreenActivity } from '@/types/database'

interface SunscreenFiltersProps {
  paRating: PaRating | ''
  whiteCast: WhiteCast | ''
  finish: SunscreenFinish | ''
  sunscreenType: SunscreenType | ''
  underMakeup: boolean
  waterResistant: boolean
  activity: SunscreenActivity | ''
  sortBy: string
  onPaRatingChange: (value: PaRating | '') => void
  onWhiteCastChange: (value: WhiteCast | '') => void
  onFinishChange: (value: SunscreenFinish | '') => void
  onSunscreenTypeChange: (value: SunscreenType | '') => void
  onUnderMakeupChange: (value: boolean) => void
  onWaterResistantChange: (value: boolean) => void
  onActivityChange: (value: SunscreenActivity | '') => void
  onSortChange: (value: string) => void
  onClearAll: () => void
}

const PA_OPTIONS: { value: PaRating; label: string }[] = [
  { value: 'PA++', label: 'PA++' },
  { value: 'PA+++', label: 'PA+++' },
  { value: 'PA++++', label: 'PA++++' },
]

const WHITE_CAST_OPTIONS: { value: WhiteCast; label: string }[] = [
  { value: 'none', label: 'No white cast' },
  { value: 'minimal', label: 'Minimal' },
]

const FINISH_OPTIONS: { value: SunscreenFinish; label: string }[] = [
  { value: 'matte', label: 'Matte' },
  { value: 'dewy', label: 'Dewy' },
  { value: 'natural', label: 'Natural' },
  { value: 'satin', label: 'Satin' },
]

const TYPE_OPTIONS: { value: SunscreenType; label: string; desc: string }[] = [
  { value: 'chemical', label: 'Chemical', desc: 'Lightweight, no cast' },
  { value: 'physical', label: 'Physical', desc: 'Mineral, gentle' },
  { value: 'hybrid', label: 'Hybrid', desc: 'Best of both' },
]

const ACTIVITY_OPTIONS: { value: SunscreenActivity; label: string }[] = [
  { value: 'daily', label: 'Daily wear' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'water_sports', label: 'Water sports' },
]

const SORT_OPTIONS = [
  { value: 'rating', label: 'Top Rated' },
  { value: 'price_asc', label: 'Price: Low' },
  { value: 'price_desc', label: 'Price: High' },
  { value: 'spf', label: 'Highest SPF' },
]

function FilterPill<T extends string>({
  value,
  current,
  label,
  onChange,
}: {
  value: T
  current: T | ''
  label: string
  onChange: (v: T | '') => void
}) {
  const active = current === value
  return (
    <button
      onClick={() => onChange(active ? '' : value)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
        active
          ? 'bg-gold text-white'
          : 'bg-white/5 text-white/40 hover:bg-gold/10'
      }`}
    >
      {label}
    </button>
  )
}

export default function SunscreenFilters({
  paRating,
  whiteCast,
  finish,
  sunscreenType,
  underMakeup,
  waterResistant,
  activity,
  sortBy,
  onPaRatingChange,
  onWhiteCastChange,
  onFinishChange,
  onSunscreenTypeChange,
  onUnderMakeupChange,
  onWaterResistantChange,
  onActivityChange,
  onSortChange,
  onClearAll,
}: SunscreenFiltersProps) {
  const hasActiveFilters =
    paRating || whiteCast || finish || sunscreenType || underMakeup || waterResistant || activity

  return (
    <div className="glass-card p-4 flex flex-col gap-4">
      {/* Quick toggles */}
      <div>
        <p className="text-xs font-medium text-white/60 mb-2">Quick filters</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onUnderMakeupChange(!underMakeup)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              underMakeup ? 'bg-gold text-white' : 'bg-white/5 text-white/40 hover:bg-gold/10'
            }`}
          >
            <Sun className="w-3 h-3 inline mr-1" />
            Under makeup
          </button>
          <button
            onClick={() => onWaterResistantChange(!waterResistant)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              waterResistant ? 'bg-gold text-white' : 'bg-white/5 text-white/40 hover:bg-gold/10'
            }`}
          >
            Water resistant
          </button>
        </div>
      </div>

      {/* PA Rating (minimum) */}
      <div>
        <p className="text-xs font-medium text-white/60 mb-2">Min PA rating</p>
        <div className="flex flex-wrap gap-1.5">
          {PA_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.value}
              value={opt.value}
              current={paRating}
              label={opt.label}
              onChange={onPaRatingChange}
            />
          ))}
        </div>
      </div>

      {/* Sunscreen type */}
      <div>
        <p className="text-xs font-medium text-white/60 mb-2">Type</p>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.value}
              value={opt.value}
              current={sunscreenType}
              label={opt.label}
              onChange={onSunscreenTypeChange}
            />
          ))}
        </div>
      </div>

      {/* White cast */}
      <div>
        <p className="text-xs font-medium text-white/60 mb-2">White cast</p>
        <div className="flex flex-wrap gap-1.5">
          {WHITE_CAST_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.value}
              value={opt.value}
              current={whiteCast}
              label={opt.label}
              onChange={onWhiteCastChange}
            />
          ))}
        </div>
      </div>

      {/* Finish */}
      <div>
        <p className="text-xs font-medium text-white/60 mb-2">Finish</p>
        <div className="flex flex-wrap gap-1.5">
          {FINISH_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.value}
              value={opt.value}
              current={finish}
              label={opt.label}
              onChange={onFinishChange}
            />
          ))}
        </div>
      </div>

      {/* Activity */}
      <div>
        <p className="text-xs font-medium text-white/60 mb-2">Activity level</p>
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.value}
              value={opt.value}
              current={activity}
              label={opt.label}
              onChange={onActivityChange}
            />
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <p className="text-xs font-medium text-white/60 mb-2">Sort by</p>
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

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors self-start"
        >
          <X className="w-3 h-3" />
          Clear all filters
        </button>
      )}
    </div>
  )
}
