'use client'

import { Filter, X } from 'lucide-react'

interface ReviewFiltersProps {
  filters: {
    skin_type?: string
    fitzpatrick_scale?: number
    age_range?: string
    reaction?: string
    sort_by?: string
  }
  onChange: (filters: ReviewFiltersProps['filters']) => void
}

const skinTypes = [
  { value: 'oily', label: 'Oily' },
  { value: 'dry', label: 'Dry' },
  { value: 'combination', label: 'Combination' },
  { value: 'normal', label: 'Normal' },
  { value: 'sensitive', label: 'Sensitive' },
]

const fitzpatrickScales = [
  { value: 1, label: 'I - Very Fair' },
  { value: 2, label: 'II - Fair' },
  { value: 3, label: 'III - Medium' },
  { value: 4, label: 'IV - Olive' },
  { value: 5, label: 'V - Brown' },
  { value: 6, label: 'VI - Dark' },
]

const ageRanges = [
  { value: '13-17', label: '13-17' },
  { value: '18-24', label: '18-24' },
  { value: '25-30', label: '25-30' },
  { value: '31-40', label: '31-40' },
  { value: '41-50', label: '41-50' },
  { value: '51+', label: '51+' },
]

const reactions = [
  { value: 'holy_grail', label: 'Holy Grail' },
  { value: 'good', label: 'Good' },
  { value: 'okay', label: 'Okay' },
  { value: 'bad', label: 'Bad' },
  { value: 'broke_me_out', label: 'Broke Me Out' },
]

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'lowest_rated', label: 'Lowest Rated' },
  { value: 'most_helpful', label: 'Most Helpful' },
]

export default function ReviewFilters({ filters, onChange }: ReviewFiltersProps) {
  const activeCount = Object.values(filters).filter(Boolean).length

  function clearAll() {
    onChange({})
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-white/40" />
          <span className="text-sm font-medium text-white">Filter Reviews</span>
          {activeCount > 0 && (
            <span className="bg-gold/10 text-gold-light border border-gold/20 rounded-full text-[10px] px-2 py-0.5">{activeCount} active</span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Filter rows */}
      <div className="space-y-2.5">
        {/* Skin type */}
        <FilterRow label="Skin Type">
          {skinTypes.map(({ value, label }) => (
            <FilterChip
              key={value}
              label={label}
              active={filters.skin_type === value}
              onClick={() =>
                onChange({
                  ...filters,
                  skin_type: filters.skin_type === value ? undefined : value,
                })
              }
            />
          ))}
        </FilterRow>

        {/* Fitzpatrick scale */}
        <FilterRow label="Fitzpatrick">
          {fitzpatrickScales.map(({ value, label }) => (
            <FilterChip
              key={value}
              label={label}
              active={filters.fitzpatrick_scale === value}
              onClick={() =>
                onChange({
                  ...filters,
                  fitzpatrick_scale: filters.fitzpatrick_scale === value ? undefined : value,
                })
              }
            />
          ))}
        </FilterRow>

        {/* Age range */}
        <FilterRow label="Age">
          {ageRanges.map(({ value, label }) => (
            <FilterChip
              key={value}
              label={label}
              active={filters.age_range === value}
              onClick={() =>
                onChange({
                  ...filters,
                  age_range: filters.age_range === value ? undefined : value,
                })
              }
            />
          ))}
        </FilterRow>

        {/* Reaction */}
        <FilterRow label="Reaction">
          {reactions.map(({ value, label }) => (
            <FilterChip
              key={value}
              label={label}
              active={filters.reaction === value}
              onClick={() =>
                onChange({
                  ...filters,
                  reaction: filters.reaction === value ? undefined : value,
                })
              }
            />
          ))}
        </FilterRow>

        {/* Sort */}
        <FilterRow label="Sort">
          {sortOptions.map(({ value, label }) => (
            <FilterChip
              key={value}
              label={label}
              active={filters.sort_by === value}
              onClick={() =>
                onChange({
                  ...filters,
                  sort_by: filters.sort_by === value ? undefined : value,
                })
              }
            />
          ))}
        </FilterRow>
      </div>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-white/40 w-16 flex-shrink-0 pt-1.5 text-right">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all duration-200 ${
        active
          ? 'bg-glass-100 text-glass-700 border border-glass-300'
          : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  )
}
