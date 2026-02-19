'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { GlassSkinScore } from '@/types/database'

interface Props {
  scores: GlassSkinScore[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getScoreGradient(score: number): string {
  if (score >= 80) return 'from-emerald-500 to-emerald-400'
  if (score >= 60) return 'from-gold to-gold-light'
  if (score >= 40) return 'from-amber-500 to-amber-400'
  return 'from-rose-500 to-rose-400'
}

export default function ProgressTimeline({ scores }: Props) {
  if (scores.length === 0) return null

  // Reverse for chronological order (oldest first) for the chart
  const chronological = [...scores].reverse()
  const maxScore = 100
  const chartHeight = 120
  const chartPadding = 24

  // Calculate SVG line chart
  const pointSpacing = chronological.length > 1
    ? (100 - chartPadding * 2 / 3) / (chronological.length - 1)
    : 50
  const points = chronological.map((s, i) => ({
    x: chronological.length === 1 ? 50 : chartPadding / 3 * 100 / chartHeight + pointSpacing * i,
    y: chartHeight - (s.overall_score / maxScore) * (chartHeight - 20) - 10,
    score: s.overall_score,
    date: s.created_at,
  }))

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}`)
    .join(' ')

  // Overall trend
  const first = chronological[0].overall_score
  const last = chronological[chronological.length - 1].overall_score
  const totalChange = last - first

  return (
    <div className="space-y-3">
      {/* Trend summary */}
      {scores.length >= 2 && (
        <div className="flex items-center gap-2 px-1">
          {totalChange > 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : totalChange < 0 ? (
            <TrendingDown className="w-4 h-4 text-rose-400" />
          ) : (
            <Minus className="w-4 h-4 text-white/40" />
          )}
          <span className="text-xs text-white/60">
            {totalChange > 0
              ? `+${totalChange} points since ${formatDate(chronological[0].created_at)}`
              : totalChange < 0
                ? `${totalChange} points since ${formatDate(chronological[0].created_at)}`
                : `No change since ${formatDate(chronological[0].created_at)}`}
          </span>
        </div>
      )}

      {/* Mini line chart */}
      {scores.length >= 2 && (
        <div className="glass-card p-3">
          <svg
            viewBox={`0 0 100 ${chartHeight}`}
            className="w-full"
            preserveAspectRatio="none"
            aria-label="Glass Skin Score progress over time"
          >
            {/* Grid lines */}
            {[25, 50, 75].map(level => {
              const y = chartHeight - (level / maxScore) * (chartHeight - 20) - 10
              return (
                <line
                  key={level}
                  x1="0%"
                  y1={y}
                  x2="100%"
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={0.5}
                />
              )
            })}

            {/* Gradient area under curve */}
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(212,165,116,0.3)" />
                <stop offset="100%" stopColor="rgba(212,165,116,0)" />
              </linearGradient>
            </defs>
            <path
              d={`${pathD} L ${points[points.length - 1].x}% ${chartHeight} L ${points[0].x}% ${chartHeight} Z`}
              fill="url(#scoreGradient)"
            />

            {/* Line */}
            <path
              d={pathD}
              fill="none"
              stroke="#D4A574"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* Dots */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={`${p.x}%`}
                cy={p.y}
                r={3}
                fill="#D4A574"
                stroke="#1a1a2e"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {/* Date labels */}
          <div className="flex justify-between mt-1 px-1">
            <span className="text-[9px] text-white/30">
              {formatDate(chronological[0].created_at)}
            </span>
            <span className="text-[9px] text-white/30">
              {formatDate(chronological[chronological.length - 1].created_at)}
            </span>
          </div>
        </div>
      )}

      {/* Score history list */}
      <div className="space-y-2">
        {scores.slice(0, 5).map((s, i) => {
          const prev = scores[i + 1]
          const change = prev ? s.overall_score - prev.overall_score : null

          return (
            <div
              key={s.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getScoreGradient(s.overall_score)} flex items-center justify-center`}
                >
                  <span className="text-xs font-bold text-white">
                    {s.overall_score}
                  </span>
                </div>
                <span className="text-xs text-white/50">
                  {formatDate(s.created_at)}
                </span>
              </div>

              {change !== null && change !== 0 && (
                <span
                  className={`text-xs font-medium ${
                    change > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {change > 0 ? '+' : ''}{change}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
