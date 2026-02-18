'use client'

import {
  FlaskConical,
  Layers,
  ShieldCheck,
  TrendingUp,
  PiggyBank,
  HeartPulse,
} from 'lucide-react'
import type { SpecialistType } from '@/types/database'

const SPECIALISTS: Array<{
  type: SpecialistType
  label: string
  shortDesc: string
  icon: React.ElementType
}> = [
  {
    type: 'ingredient_analyst',
    label: 'Ingredients',
    shortDesc: 'Analyze ingredients & safety',
    icon: FlaskConical,
  },
  {
    type: 'routine_architect',
    label: 'Routines',
    shortDesc: 'Build your AM/PM routine',
    icon: Layers,
  },
  {
    type: 'authenticity_investigator',
    label: 'Authenticity',
    shortDesc: 'Check if products are real',
    icon: ShieldCheck,
  },
  {
    type: 'trend_scout',
    label: 'Trends',
    shortDesc: "What's hot in Korea",
    icon: TrendingUp,
  },
  {
    type: 'budget_optimizer',
    label: 'Budget',
    shortDesc: 'Find dupes & save money',
    icon: PiggyBank,
  },
  {
    type: 'sensitivity_guardian',
    label: 'Sensitivity',
    shortDesc: 'Allergy & reaction safety',
    icon: HeartPulse,
  },
]

interface SpecialistPickerProps {
  onSelect: (type: SpecialistType) => void
}

export default function SpecialistPicker({ onSelect }: SpecialistPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {SPECIALISTS.map(({ type, label, shortDesc, icon: Icon }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className="glass-card p-3 flex flex-col items-start gap-2 transition-all duration-300 group text-left hover:border-gold/30 hover:bg-white/[0.07]"
        >
          <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
            <Icon className="w-4 h-4 text-gold" strokeWidth={2} />
          </div>
          <div>
            <p className="font-display font-semibold text-xs text-white">
              {label}
            </p>
            <p className="text-[10px] text-white/40 leading-snug mt-0.5">
              {shortDesc}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
