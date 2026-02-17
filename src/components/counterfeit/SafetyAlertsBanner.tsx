'use client'

import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  ShieldAlert,
  X,
  Bell,
  AlertOctagon,
  Info,
} from 'lucide-react'
import type { SafetyAlert, AlertSeverity } from '@/types/database'

const SEVERITY_CONFIG: Record<AlertSeverity, { icon: typeof AlertTriangle; bg: string; border: string; text: string; iconColor: string }> = {
  critical: { icon: AlertOctagon, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', iconColor: 'text-red-500' },
  high: { icon: ShieldAlert, bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', iconColor: 'text-orange-500' },
  medium: { icon: AlertTriangle, bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', iconColor: 'text-yellow-500' },
  low: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', iconColor: 'text-blue-500' },
}

export default function SafetyAlertsBanner() {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/safety-alerts')
        if (!res.ok) return
        const data = await res.json()
        setAlerts(data.alerts || [])
      } catch {
        // Silently fail -- alerts are non-critical
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const dismissAlert = async (alertId: string) => {
    setDismissedIds(prev => new Set(prev).add(alertId))
    try {
      await fetch('/api/safety-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      })
    } catch {
      // Best-effort dismiss
    }
  }

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id))

  if (loading || visibleAlerts.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {visibleAlerts.map(alert => {
        const config = SEVERITY_CONFIG[alert.severity]
        const Icon = config.icon

        return (
          <div
            key={alert.id}
            className={`${config.bg} border ${config.border} rounded-xl p-3 flex items-start gap-2.5 animate-fade-in`}
          >
            <Icon className={`w-4.5 h-4.5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-xs font-semibold ${config.text}`}>{alert.title}</p>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="flex-shrink-0 w-5 h-5 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors"
                >
                  <X className="w-3 h-3 text-seoul-soft" />
                </button>
              </div>
              <p className={`text-[11px] ${config.text} opacity-80 mt-0.5 leading-relaxed`}>
                {alert.description}
              </p>
              {alert.affected_brands && alert.affected_brands.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {alert.affected_brands.map(b => (
                    <span key={b} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${config.bg} ${config.text} border ${config.border}`}>
                      {b}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[9px] ${config.text} opacity-60`}>
                  {new Date(alert.created_at).toLocaleDateString()}
                </span>
                {alert.source && (
                  <span className={`text-[9px] ${config.text} opacity-60`}>
                    Source: {alert.source}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
