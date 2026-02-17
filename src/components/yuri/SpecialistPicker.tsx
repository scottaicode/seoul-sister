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
  color: string
}> = [
  {
    type: 'ingredient_analyst',
    label: 'Ingredients',
    shortDesc: 'Analyze ingredients & safety',
    icon: FlaskConical,
    color: 'from-violet-400 to-violet-600',
  },
  {
    type: 'routine_architect',
    label: 'Routines',
    shortDesc: 'Build your AM/PM routine',
    icon: Layers,
    color: 'from-blue-400 to-blue-600',
  },
  {
    type: 'authenticity_investigator',
    label: 'Authenticity',
    shortDesc: 'Check if products are real',
    icon: ShieldCheck,
    color: 'from-emerald-400 to-emerald-600',
  },
  {
    type: 'trend_scout',
    label: 'Trends',
    shortDesc: "What's hot in Korea",
    icon: TrendingUp,
    color: 'from-amber-400 to-amber-600',
  },
  {
    type: 'budget_optimizer',
    label: 'Budget',
    shortDesc: 'Find dupes & save money',
    icon: PiggyBank,
    color: 'from-green-400 to-green-600',
  },
  {
    type: 'sensitivity_guardian',
    label: 'Sensitivity',
    shortDesc: 'Allergy & reaction safety',
    icon: HeartPulse,
    color: 'from-rose-400 to-rose-600',
  },
]

interface SpecialistPickerProps {
  onSelect: (type: SpecialistType) => void
}

export default function SpecialistPicker({ onSelect }: SpecialistPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {SPECIALISTS.map(({ type, label, shortDesc, icon: Icon, color }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className="glass-card p-3 flex flex-col items-start gap-2 hover:shadow-glass-lg transition-all duration-300 group text-left"
        >
          <div
            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}
          >
            <Icon className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="font-display font-semibold text-xs text-seoul-charcoal">
              {label}
            </p>
            <p className="text-[10px] text-seoul-soft leading-snug mt-0.5">
              {shortDesc}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
