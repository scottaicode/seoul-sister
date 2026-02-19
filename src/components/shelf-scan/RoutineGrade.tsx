'use client'

import type { RoutineGradeLevel } from '@/types/database'

function getGradeColor(grade: RoutineGradeLevel): {
  text: string
  bg: string
  ring: string
  glow: string
} {
  switch (grade) {
    case 'A':
      return {
        text: 'text-emerald-400',
        bg: 'bg-emerald-400/10',
        ring: 'ring-emerald-400/30',
        glow: 'shadow-emerald-400/20',
      }
    case 'B':
      return {
        text: 'text-sky-400',
        bg: 'bg-sky-400/10',
        ring: 'ring-sky-400/30',
        glow: 'shadow-sky-400/20',
      }
    case 'C':
      return {
        text: 'text-amber-400',
        bg: 'bg-amber-400/10',
        ring: 'ring-amber-400/30',
        glow: 'shadow-amber-400/20',
      }
    case 'D':
      return {
        text: 'text-orange-400',
        bg: 'bg-orange-400/10',
        ring: 'ring-orange-400/30',
        glow: 'shadow-orange-400/20',
      }
    case 'F':
      return {
        text: 'text-rose-400',
        bg: 'bg-rose-400/10',
        ring: 'ring-rose-400/30',
        glow: 'shadow-rose-400/20',
      }
  }
}

function getGradeLabel(grade: RoutineGradeLevel): string {
  switch (grade) {
    case 'A': return 'Excellent Collection'
    case 'B': return 'Great Collection'
    case 'C': return 'Good Start'
    case 'D': return 'Needs Work'
    case 'F': return 'Just Getting Started'
  }
}

interface RoutineGradeProps {
  grade: RoutineGradeLevel
  rationale: string
}

export default function RoutineGrade({ grade, rationale }: RoutineGradeProps) {
  const colors = getGradeColor(grade)

  return (
    <div className={`glass-card-strong p-6 text-center ring-1 ${colors.ring}`}>
      {/* Large grade letter */}
      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl ${colors.bg} shadow-lg ${colors.glow} mb-3`}>
        <span className={`text-5xl font-bold ${colors.text}`}>
          {grade}
        </span>
      </div>

      <p className="font-display font-semibold text-base text-white">
        {getGradeLabel(grade)}
      </p>

      <p className="text-xs text-white/50 mt-1.5 max-w-xs mx-auto leading-relaxed">
        {rationale}
      </p>
    </div>
  )
}
