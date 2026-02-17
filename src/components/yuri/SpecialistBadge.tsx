import {
  FlaskConical,
  Layers,
  ShieldCheck,
  TrendingUp,
  PiggyBank,
  HeartPulse,
} from 'lucide-react'
import type { SpecialistType } from '@/types/database'

const SPECIALIST_META: Record<
  SpecialistType,
  { label: string; icon: React.ElementType; color: string }
> = {
  ingredient_analyst: {
    label: 'Ingredient Analyst',
    icon: FlaskConical,
    color: 'bg-violet-100 text-violet-700',
  },
  routine_architect: {
    label: 'Routine Architect',
    icon: Layers,
    color: 'bg-blue-100 text-blue-700',
  },
  authenticity_investigator: {
    label: 'Authenticity Check',
    icon: ShieldCheck,
    color: 'bg-emerald-100 text-emerald-700',
  },
  trend_scout: {
    label: 'Trend Scout',
    icon: TrendingUp,
    color: 'bg-amber-100 text-amber-700',
  },
  budget_optimizer: {
    label: 'Budget Optimizer',
    icon: PiggyBank,
    color: 'bg-green-100 text-green-700',
  },
  sensitivity_guardian: {
    label: 'Sensitivity Guardian',
    icon: HeartPulse,
    color: 'bg-rose-100 text-rose-700',
  },
}

interface SpecialistBadgeProps {
  type: SpecialistType
  size?: 'sm' | 'md'
}

export default function SpecialistBadge({ type, size = 'sm' }: SpecialistBadgeProps) {
  const meta = SPECIALIST_META[type]
  if (!meta) return null

  const Icon = meta.icon

  if (size === 'sm') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.color}`}
      >
        <Icon className="w-2.5 h-2.5" />
        {meta.label}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${meta.color}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  )
}
