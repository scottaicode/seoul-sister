'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FlaskConical, X, Package, Plus, Minus, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ReformulationAlert as ReformulationAlertType } from '@/types/database'

export default function ReformulationAlertWidget() {
  const [alerts, setAlerts] = useState<ReformulationAlertType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) { setLoading(false); return }

        const res = await fetch('/api/reformulations', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setAlerts((data.alerts ?? []).slice(0, 3))
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function dismissAlert(alertId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      await fetch(`/api/reformulations/${alertId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch {
      // Non-critical
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-gold/40" />
      </div>
    )
  }

  if (alerts.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => {
        const product = alert.product as unknown as {
          id: string; name_en: string; brand_en: string; image_url: string | null; category: string
        } | null
        const history = alert.formulation_history as unknown as {
          change_type: string; change_summary: string | null;
          ingredients_added: string[]; ingredients_removed: string[]
        } | null

        const name = product?.name_en ?? 'Unknown Product'
        const brand = product?.brand_en ?? null

        return (
          <div
            key={alert.id}
            className="glass-card p-3 space-y-2 border-amber-500/15"
          >
            <div className="flex items-start gap-3">
              {/* Product icon */}
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                {product?.image_url ? (
                  <img
                    src={product.image_url}
                    alt={name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{name}</p>
                {brand && <p className="text-[10px] text-white/30">{brand}</p>}
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => dismissAlert(alert.id)}
                className="p-1 rounded-md hover:bg-white/5 transition-colors"
                title="Dismiss"
              >
                <X className="w-3 h-3 text-white/30" />
              </button>
            </div>

            {/* Change details */}
            {history && (
              <div className="space-y-1 pl-11">
                {history.ingredients_added?.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Plus className="w-2.5 h-2.5 text-green-400" />
                    <span className="text-[10px] text-green-400/80 truncate">
                      {history.ingredients_added.slice(0, 2).join(', ')}
                      {history.ingredients_added.length > 2 && ` +${history.ingredients_added.length - 2}`}
                    </span>
                  </div>
                )}
                {history.ingredients_removed?.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Minus className="w-2.5 h-2.5 text-red-400" />
                    <span className="text-[10px] text-red-400/80 truncate">
                      {history.ingredients_removed.slice(0, 2).join(', ')}
                      {history.ingredients_removed.length > 2 && ` +${history.ingredients_removed.length - 2}`}
                    </span>
                  </div>
                )}
                {history.change_summary && !history.ingredients_added?.length && !history.ingredients_removed?.length && (
                  <p className="text-[10px] text-white/40 truncate">
                    {history.change_summary}
                  </p>
                )}
              </div>
            )}

            {/* View details link */}
            {product?.id && (
              <div className="pl-11">
                <Link
                  href={`/products/${product.id}`}
                  className="text-[10px] text-gold-light font-medium hover:text-gold transition-colors"
                >
                  View product details
                </Link>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
