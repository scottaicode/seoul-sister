'use client'

import { Award, Star, Crown, Gem } from 'lucide-react'

interface PointsBadgeProps {
  points: number
  compact?: boolean
}

function getLevel(points: number) {
  if (points >= 500) return { name: 'K-Beauty Expert', icon: Crown, color: 'text-purple-400 bg-purple-500/20', next: null }
  if (points >= 200) return { name: 'Glow Getter', icon: Gem, color: 'text-rose-gold bg-rose-gold/10', next: 500 }
  if (points >= 50) return { name: 'Skin Scholar', icon: Star, color: 'text-glass-500 bg-glass-500/10', next: 200 }
  return { name: 'Newcomer', icon: Award, color: 'text-white/50 bg-white/10', next: 50 }
}

export default function PointsBadge({ points, compact = false }: PointsBadgeProps) {
  const level = getLevel(points)
  const LevelIcon = level.icon

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${level.color}`}>
        <LevelIcon className="w-2.5 h-2.5" />
        {points} pts
      </span>
    )
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${level.color}`}>
          <LevelIcon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-display font-semibold text-sm text-white">{level.name}</p>
          <p className="text-[10px] text-white/40">{points} community points</p>
        </div>
      </div>

      {/* Progress bar to next level */}
      {level.next && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">Progress to next level</span>
            <span className="text-[10px] text-white/40">{points}/{level.next}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-gold to-glass-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((points / level.next) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
