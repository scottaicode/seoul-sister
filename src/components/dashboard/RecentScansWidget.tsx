'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/ui/EmptyState'

interface RecentScan {
  id: string
  product_id: string | null
  scan_type: string
  ingredients_found: string[] | null
  analysis_result: Record<string, unknown> | null
  created_at: string
  product: {
    id: string
    name_en: string | null
    brand_en: string | null
    category: string | null
  } | null
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function RecentScansWidget() {
  const [scans, setScans] = useState<RecentScan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          if (!cancelled) setLoading(false)
          return
        }
        const res = await fetch('/api/scans/recent', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (!cancelled) setScans(json.scans ?? [])
        }
      } catch {
        // Non-critical widget
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-gold/40" />
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title="No scans yet"
        description="Scan a Korean product label to get instant ingredient analysis, safety scoring, and personalised insights."
        actionLabel="Scan a product"
        actionHref="/scan"
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {scans.map((scan) => {
        const analysis = scan.analysis_result?.analysis as Record<string, unknown> | undefined
        const productName =
          scan.product?.name_en ||
          (analysis?.product_name_en as string) ||
          'Unknown Product'
        const brandName =
          scan.product?.brand_en || (analysis?.brand as string) || ''
        const safetyScore = analysis?.overall_safety_score as number | undefined
        const ingredientCount = scan.ingredients_found?.length ?? 0

        const href = scan.product_id ? `/products/${scan.product_id}` : '/scan'

        return (
          <Link
            key={scan.id}
            href={href}
            className="glass-card p-3 flex items-center gap-3 hover:bg-white/[0.06] transition-colors duration-200 group"
          >
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
              <Camera className="w-5 h-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {productName}
              </p>
              <p className="text-[10px] text-white/40 mt-0.5 truncate">
                {brandName && <span>{brandName} &middot; </span>}
                {ingredientCount > 0 && <span>{ingredientCount} ingredients &middot; </span>}
                <span>{timeAgo(scan.created_at)}</span>
              </p>
            </div>
            {typeof safetyScore === 'number' && (
              <div className="flex-shrink-0 text-right">
                <p className="text-xs font-semibold text-emerald-400">{safetyScore}</p>
                <p className="text-[9px] text-white/30 uppercase tracking-wider">Safety</p>
              </div>
            )}
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-gold transition-colors" />
          </Link>
        )
      })}
    </div>
  )
}
