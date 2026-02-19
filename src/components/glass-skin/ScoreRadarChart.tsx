'use client'

import type { GlassSkinScore, GlassSkinDimension } from '@/types/database'

interface Props {
  score: GlassSkinScore
  previous?: GlassSkinScore | null
  size?: number
}

interface DimensionConfig {
  key: GlassSkinDimension
  label: string
  labelKo: string
}

const DIMENSIONS: DimensionConfig[] = [
  { key: 'luminosity', label: 'Luminosity', labelKo: '광채' },
  { key: 'smoothness', label: 'Smoothness', labelKo: '매끄러움' },
  { key: 'clarity', label: 'Clarity', labelKo: '투명도' },
  { key: 'hydration', label: 'Hydration', labelKo: '수분' },
  { key: 'evenness', label: 'Evenness', labelKo: '균일' },
]

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-gold'
  if (score >= 40) return 'text-amber-400'
  return 'text-rose-400'
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  }
}

function buildPolygonPoints(
  cx: number,
  cy: number,
  radius: number,
  scores: number[],
  maxScore: number
): string {
  return scores
    .map((score, i) => {
      const angle = (360 / scores.length) * i
      const r = (score / maxScore) * radius
      const { x, y } = polarToCartesian(cx, cy, r, angle)
      return `${x},${y}`
    })
    .join(' ')
}

export default function ScoreRadarChart({ score, previous, size = 280 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.38
  const levels = [20, 40, 60, 80, 100]

  const currentScores = DIMENSIONS.map(d => score[`${d.key}_score`])
  const previousScores = previous
    ? DIMENSIONS.map(d => previous[`${d.key}_score`])
    : null

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Radar Chart SVG */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[280px]"
        aria-label="Glass Skin Score radar chart"
      >
        {/* Background grid rings */}
        {levels.map(level => {
          const r = (level / 100) * radius
          const points = DIMENSIONS.map((_, i) => {
            const angle = (360 / DIMENSIONS.length) * i
            const { x, y } = polarToCartesian(cx, cy, r, angle)
            return `${x},${y}`
          }).join(' ')
          return (
            <polygon
              key={level}
              points={points}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          )
        })}

        {/* Axis lines */}
        {DIMENSIONS.map((_, i) => {
          const angle = (360 / DIMENSIONS.length) * i
          const { x, y } = polarToCartesian(cx, cy, radius, angle)
          return (
            <line
              key={`axis-${i}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          )
        })}

        {/* Previous score polygon (faded) */}
        {previousScores && (
          <polygon
            points={buildPolygonPoints(cx, cy, radius, previousScores, 100)}
            fill="rgba(255,255,255,0.05)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1}
            strokeDasharray="4 2"
          />
        )}

        {/* Current score polygon */}
        <polygon
          points={buildPolygonPoints(cx, cy, radius, currentScores, 100)}
          fill="rgba(212,165,116,0.15)"
          stroke="rgba(212,165,116,0.8)"
          strokeWidth={2}
        />

        {/* Score dots */}
        {currentScores.map((s, i) => {
          const angle = (360 / DIMENSIONS.length) * i
          const r = (s / 100) * radius
          const { x, y } = polarToCartesian(cx, cy, r, angle)
          return (
            <circle
              key={`dot-${i}`}
              cx={x}
              cy={y}
              r={4}
              fill="#D4A574"
              stroke="#1a1a2e"
              strokeWidth={2}
            />
          )
        })}

        {/* Labels */}
        {DIMENSIONS.map((dim, i) => {
          const angle = (360 / DIMENSIONS.length) * i
          const labelR = radius + 28
          const { x, y } = polarToCartesian(cx, cy, labelR, angle)
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white/60 text-[9px] font-medium"
            >
              {dim.label}
            </text>
          )
        })}
      </svg>

      {/* Dimension scores list */}
      <div className="w-full grid grid-cols-5 gap-2">
        {DIMENSIONS.map((dim, i) => {
          const currentVal = currentScores[i]
          const prevVal = previousScores?.[i]
          const change = prevVal != null ? currentVal - prevVal : null

          return (
            <div key={dim.key} className="flex flex-col items-center gap-1">
              <span className={`text-lg font-bold ${getScoreColor(currentVal)}`}>
                {currentVal}
              </span>
              <span className="text-[10px] text-white/40 text-center leading-tight">
                {dim.labelKo}
              </span>
              {change !== null && change !== 0 && (
                <span
                  className={`text-[10px] font-medium ${
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
