'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MapPin,
  ChevronRight,
  Droplets,
  Sun,
  Wind,
  Thermometer,
  CloudRain,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { WeatherRoutineResponse, WeatherRoutineAdjustment } from '@/types/database'

const ADJUSTMENT_ICONS: Record<WeatherRoutineAdjustment['type'], string> = {
  add: '+',
  reduce: '-',
  swap: '\u21C4',
  avoid: '\u2715',
  emphasize: '\u2191',
}

const ADJUSTMENT_COLORS: Record<WeatherRoutineAdjustment['type'], string> = {
  add: 'text-emerald-400 bg-emerald-400/10',
  reduce: 'text-amber-400 bg-amber-400/10',
  swap: 'text-sky-400 bg-sky-400/10',
  avoid: 'text-rose-400 bg-rose-400/10',
  emphasize: 'text-gold bg-gold/10',
}

function getConditionIcon(icon: string) {
  if (icon === 'rain' || icon === 'drizzle') return CloudRain
  if (icon === 'clear') return Sun
  if (icon === 'storm') return Wind
  return Droplets
}

export default function WeatherRoutineWidget() {
  const [data, setData] = useState<WeatherRoutineResponse | null>(null)
  const [hasLocation, setHasLocation] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch('/api/weather/routine', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (res.ok) {
          const json = await res.json()
          setData(json)
          setHasLocation(true)
        } else if (res.status === 400) {
          // No location set
          setHasLocation(false)
        }
      } catch {
        // Non-critical widget
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return null

  // No location configured — show CTA to set it
  if (hasLocation === false) {
    return (
      <Link
        href="/profile"
        className="glass-card p-4 flex items-center gap-3 hover:bg-white/[0.06] transition-colors duration-200 group"
      >
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-sky-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Set your location</p>
          <p className="text-xs text-white/40 mt-0.5">
            Get weather-based skincare tips personalised to your climate
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-gold transition-colors" />
      </Link>
    )
  }

  if (!data) return null

  const { weather, adjustments, summary } = data
  const ConditionIcon = getConditionIcon(weather.icon)
  const displayAdjustments = adjustments.slice(0, 3)

  return (
    <div className="glass-card p-4 space-y-3">
      {/* Weather header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
          <ConditionIcon className="w-5 h-5 text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Thermometer className="w-3 h-3 text-white/40" />
            <span className="text-sm font-semibold text-white">{weather.temperature}&deg;C</span>
            <span className="text-xs text-white/30">&middot;</span>
            <Droplets className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/50">{weather.humidity}%</span>
            {weather.uv_index > 0 && (
              <>
                <span className="text-xs text-white/30">&middot;</span>
                <Sun className="w-3 h-3 text-white/40" />
                <span className="text-xs text-white/50">UV {weather.uv_index}</span>
              </>
            )}
            {weather.wind_speed > 5 && (
              <>
                <span className="text-xs text-white/30">&middot;</span>
                <Wind className="w-3 h-3 text-white/40" />
                <span className="text-xs text-white/50">{weather.wind_speed} m/s</span>
              </>
            )}
          </div>
          <p className="text-[10px] text-white/30 mt-0.5 flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" />
            {weather.location} &middot; {weather.condition}
          </p>
        </div>
      </div>

      {/* Summary */}
      <p className="text-xs text-white/50">{summary}</p>

      {/* Adjustments */}
      {displayAdjustments.length > 0 && (
        <div className="space-y-2">
          {displayAdjustments.map((adj, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5"
            >
              <span
                className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${ADJUSTMENT_COLORS[adj.type]}`}
              >
                {ADJUSTMENT_ICONS[adj.type]}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white">
                  {adj.suggestion}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">{adj.reason}</p>
              </div>
            </div>
          ))}
          {adjustments.length > 3 && (
            <p className="text-[10px] text-gold-light pl-7">
              +{adjustments.length - 3} more suggestion{adjustments.length - 3 !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
