'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, ChevronRight, Package, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ExpiringItem {
  id: string
  product_id: string | null
  custom_product_name: string | null
  expiry_date: string
  pao_months: number | null
  product: {
    id: string
    name_en: string
    brand_en: string
    category: string
    image_url: string | null
  } | null
}

function getDaysRemaining(expiryDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function ExpiringProductsWidget() {
  const [items, setItems] = useState<ExpiringItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) { setLoading(false); return }

        const res = await fetch('/api/tracking/expiring?days=30', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setItems((data.expiring ?? []).slice(0, 3))
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-gold/40" />
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const days = getDaysRemaining(item.expiry_date)
        const name = item.product?.name_en || item.custom_product_name || 'Unknown'
        const brand = item.product?.brand_en || null
        const isUrgent = days <= 14

        return (
          <div
            key={item.id}
            className={`glass-card p-3 flex items-center gap-3 ${
              isUrgent ? 'border-red-500/20' : 'border-amber-500/10'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isUrgent ? 'bg-red-500/10' : 'bg-amber-500/10'
            }`}>
              {item.product?.image_url ? (
                <img
                  src={item.product.image_url}
                  alt={name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <Package className={`w-3.5 h-3.5 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{name}</p>
              {brand && <p className="text-[10px] text-white/30">{brand}</p>}
            </div>

            <span className={`text-[10px] font-semibold whitespace-nowrap ${
              isUrgent ? 'text-red-400' : 'text-amber-400'
            }`}>
              {days <= 0 ? 'Expired' : days === 1 ? '1 day' : `${days} days`}
            </span>
          </div>
        )
      })}
    </div>
  )
}
